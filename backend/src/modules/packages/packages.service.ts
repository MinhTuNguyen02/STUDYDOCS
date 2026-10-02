import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { LedgerService } from '../wallets/ledger.service';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationsService } from '../notifications/notifications.service';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService
  ) {}

  private async resolvePurchaseReplay(
    customerId: number,
    packageId: number,
    idempotencyKey: string
  ) {
    const previous = await this.prisma.user_packages.findUnique({
      where: {
        customer_id_idempotency_key: {
          customer_id: customerId,
          idempotency_key: idempotencyKey
        }
      },
      include: { packages: { select: { name: true } } }
    });
    if (!previous) return null;
    if (previous.package_id !== packageId) {
      throw new ConflictException('Idempotency key đã được dùng cho một gói khác.');
    }
    return {
      message: `Yêu cầu mua gói ${previous.packages.name} đã được xử lý.`,
      data: previous,
      replayed: true
    };
  }

  async getActivePackages() {
    const packages = await this.prisma.packages.findMany({
      where: { status: 'ACTIVE', delete_at: null },
      orderBy: { price: 'asc' }
    });
    return { data: packages };
  }

  async getAllPackages() {
    return {
      data: await this.prisma.packages.findMany({
        orderBy: { created_at: 'desc' }
      })
    };
  }

  // ── Lấy danh sách gói của user hiện tại (ACTIVE + PENDING) ──
  async getMyPackages(user: AuthUser) {
    if (!user.customerId) return { data: [] };

    const userPackages = await this.prisma.user_packages.findMany({
      where: {
        customer_id: user.customerId,
        status: { in: ['ACTIVE', 'PENDING'] }
      },
      include: {
        packages: {
          select: { name: true, download_turns: true, duration_days: true }
        }
      },
      orderBy: { purchased_at: 'asc' }
    });

    return {
      data: userPackages.map((up, idx) => ({
        userPackageId: up.user_package_id,
        packageId: up.package_id,
        name: up.packages.name,
        turnsRemaining: up.turns_remaining,
        totalTurns: up.packages.download_turns,
        durationDays: up.packages.duration_days,
        status: up.status,
        purchasedAt: up.purchased_at,
        expiresAt: up.expires_at, // null nếu PENDING
        queuePosition: idx // 0 = đang dùng, 1+ = đang chờ
      }))
    };
  }

  async createPackage(dto: CreatePackageDto, actor: AuthUser) {
    const pkg = await this.prisma.packages.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        download_turns: dto.download_turns,
        duration_days: dto.duration_days ?? 30,
        status: dto.is_active !== undefined ? (dto.is_active ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE'
      }
    });
    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_CREATE_PACKAGE',
        target_table: 'packages',
        target_id: pkg.package_id,
        new_value: { name: pkg.name, price: pkg.price }
      }
    });

    return { message: 'Tạo gói tải xuống thành công.', data: pkg };
  }

  async updatePackage(id: number, dto: UpdatePackageDto, actor: AuthUser) {
    const existing = await this.prisma.packages.findUnique({ where: { package_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói này.');

    const pkg = await this.prisma.packages.update({
      where: { package_id: id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        download_turns: dto.download_turns,
        duration_days: dto.duration_days,
        status:
          dto.is_active !== undefined ? (dto.is_active ? 'ACTIVE' : 'INACTIVE') : existing.status
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_UPDATE_PACKAGE',
        target_table: 'packages',
        target_id: id,
        old_value: {
          name: existing.name,
          price: existing.price,
          status: existing.status,
          description: existing.description,
          download_turns: existing.download_turns,
          duration_days: existing.duration_days
        },
        new_value: {
          name: pkg.name,
          price: pkg.price,
          status: pkg.status,
          description: pkg.description,
          download_turns: pkg.download_turns,
          duration_days: pkg.duration_days
        }
      }
    });

    return { message: 'Cập nhật thành công.', data: pkg };
  }

  async buyPackage(user: AuthUser, packageId: number, idempotencyKey: string) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có thể mua gói.');

    const previous = await this.resolvePurchaseReplay(user.customerId, packageId, idempotencyKey);
    if (previous) return previous;

    const pkg = await this.prisma.packages.findUnique({
      where: { package_id: packageId, status: 'ACTIVE', delete_at: null }
    });

    if (!pkg) throw new NotFoundException('Gói tải xuống không khả dụng.');

    const paymentWallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: { customer_id: user.customerId, wallet_type: 'PAYMENT' }
      }
    });

    if (!paymentWallet || paymentWallet.balance.lt(pkg.price)) {
      throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
    }

    // Kiểm tra xem user có gói ACTIVE chưa → nếu có thì gói mới sẽ là PENDING
    const hasActivePackage = await this.prisma.user_packages.findFirst({
      where: { customer_id: user.customerId, status: 'ACTIVE' }
    });

    // Nếu PENDING: expires_at = null (chưa tính hạn)
    // Nếu ACTIVE:  expires_at = now + duration_days
    const newStatus = hasActivePackage ? 'PENDING' : 'ACTIVE';
    const expiresAt = hasActivePackage
      ? null
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + pkg.duration_days);
          return d;
        })();

    let result;
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const deducted = await tx.wallets.updateMany({
            where: { wallet_id: paymentWallet.wallet_id, balance: { gte: pkg.price } },
            data: { balance: { decrement: pkg.price } }
          });
          if (deducted.count !== 1) {
            throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
          }

          // Get system wallets for double-entry
          const { systemRevenue } = await this.ledger.getSystemWallets(tx);

          await tx.wallets.update({
            where: { wallet_id: systemRevenue.wallet_id },
            data: { balance: { increment: pkg.price } }
          });

          // Create package
          const userPkg = await tx.user_packages.create({
            data: {
              customer_id: user.customerId!,
              package_id: pkg.package_id,
              idempotency_key: idempotencyKey,
              turns_remaining: pkg.download_turns,
              expires_at: expiresAt,
              status: newStatus,
              active_slot: newStatus === 'ACTIVE' ? 1 : null
            }
          });

          // Record Ledger: Debit paymentWallet, Credit SYSTEM_REVENUE
          await this.ledger.recordTransaction(
            tx,
            'PURCHASE',
            'USER_PACKAGE',
            userPkg.user_package_id,
            `Mua gói dịch vụ: ${pkg.name}`,
            [
              { wallet_id: paymentWallet.wallet_id, debit_amount: pkg.price, credit_amount: 0 },
              { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: pkg.price }
            ]
          );

          return userPkg;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replayed = await this.resolvePurchaseReplay(
          user.customerId,
          packageId,
          idempotencyKey
        );
        if (replayed) return replayed;
        throw new ConflictException('Trạng thái gói vừa thay đổi. Vui lòng thử lại yêu cầu.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        // A concurrent request with the same key may still be committing. Give the
        // winning transaction a short bounded window, then return its result.
        for (let attempt = 1; attempt <= 4; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 25));
          const replayed = await this.resolvePurchaseReplay(
            user.customerId,
            packageId,
            idempotencyKey
          );
          if (replayed) return replayed;
        }
        throw new ConflictException('Giao dịch đang bị xung đột. Vui lòng thử lại.');
      }
      throw error;
    }

    const statusMessage =
      newStatus === 'PENDING'
        ? `Gói "${pkg.name}" đã được thêm vào hàng chờ. Sẽ tự động kích hoạt khi gói hiện tại hết hạn hoặc hết lượt tải xuống.`
        : `Mua thành công gói ${pkg.name}.`;

    // Notify buyer wallet update
    this.notifications.notifyAccountWalletChange(Number(user.accountId));

    return { message: statusMessage, data: result, replayed: false };
  }

  // ── Helper: Kích hoạt gói PENDING tiếp theo của user ──────────
  async activateNextPending(customerId: number) {
    const activated = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${customerId})`;
        const active = await tx.user_packages.findFirst({
          where: { customer_id: customerId, status: 'ACTIVE' },
          select: { user_package_id: true }
        });
        if (active) return null;

        const pending = await tx.user_packages.findFirst({
          where: { customer_id: customerId, status: 'PENDING' },
          include: { packages: { select: { duration_days: true } } },
          orderBy: { purchased_at: 'asc' }
        });
        if (!pending) return null;

        const expiresAt = new Date(Date.now() + pending.packages.duration_days * 86_400_000);
        return tx.user_packages.update({
          where: { user_package_id: pending.user_package_id },
          data: { status: 'ACTIVE', active_slot: 1, expires_at: expiresAt }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!activated) return null;

    this.logger.log(
      `Activated pending package #${activated.user_package_id} for customer ${customerId}.`
    );

    return activated;
  }

  async deletePackage(id: number, actor: AuthUser) {
    const existing = await this.prisma.packages.findUnique({ where: { package_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói này.');

    await this.prisma.packages.update({
      where: { package_id: id },
      data: { delete_at: new Date() }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_DELETE_PACKAGE',
        target_table: 'packages',
        target_id: id,
        old_value: { name: existing.name }
      }
    });

    return { message: 'Đã xóa gói dịch vụ thành công.' };
  }

  // ── Cronjob: Expire gói hết hạn + kích hoạt gói PENDING tiếp theo ──
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpirePackages() {
    this.logger.log('Running daily expire packages job...');

    // 1. Tìm tất cả gói ACTIVE đã hết hạn
    const expiredPackages = await this.prisma.user_packages.findMany({
      where: { status: 'ACTIVE', expires_at: { lt: new Date() } },
      select: { user_package_id: true, customer_id: true }
    });

    if (expiredPackages.length === 0) {
      this.logger.log('No packages to expire.');
      return;
    }

    // 2. Đánh dấu EXPIRED
    const expiredIds = expiredPackages.map((p) => p.user_package_id);
    await this.prisma.user_packages.updateMany({
      where: { user_package_id: { in: expiredIds } },
      data: { status: 'EXPIRED', active_slot: null }
    });
    this.logger.log(`Expired ${expiredPackages.length} packages.`);

    // 3. Với mỗi customer bị expire, kích hoạt gói PENDING tiếp theo (nếu có)
    const uniqueCustomerIds = [...new Set(expiredPackages.map((p) => p.customer_id))];
    for (const customerId of uniqueCustomerIds) {
      await this.activateNextPending(customerId);
    }
  }

  // ── Cronjob: Reset lượt tải miễn phí đầu mỗi tháng ────────────
  @Cron('0 0 1 * *')
  async resetFreeDownloads() {
    this.logger.log('Running monthly reset free downloads job...');
    const result = await this.prisma.customer_profiles.updateMany({
      data: { free_downloads_remaining: 4 }
    });
    this.logger.log(`Reset free downloads for ${result.count} customer profiles.`);
  }
}
