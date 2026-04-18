import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { LedgerService } from '../wallets/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getActivePackages() {
    const packages = await this.prisma.packages.findMany({
      where: { status: 'ACTIVE', delete_at: null },
      orderBy: { price: 'asc' },
    });
    return { data: packages };
  }

  async getAllPackages() {
    return {
      data: await this.prisma.packages.findMany({
        orderBy: { created_at: 'desc' },
      }),
    };
  }

  async createPackage(dto: any, actor: AuthUser) {
    const pkg = await this.prisma.packages.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        download_turns: dto.download_turns,
        duration_days: dto.duration_days ?? 30,
        status: dto.is_active !== undefined ? (dto.is_active ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE',
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_CREATE_PACKAGE',
        target_table: 'packages',
        target_id: pkg.package_id,
        new_value: { name: pkg.name, price: pkg.price },
      },
    });

    return { message: 'Tạo gói tải thành công.', data: pkg };
  }

  async updatePackage(id: number, dto: any, actor: AuthUser) {
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
        status: dto.is_active !== undefined ? (dto.is_active ? 'ACTIVE' : 'INACTIVE') : existing.status,
      },
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
          duration_days: existing.duration_days,
        },
        new_value: {
          name: pkg.name,
          price: pkg.price,
          status: pkg.status,
          description: pkg.description,
          download_turns: pkg.download_turns,
          duration_days: pkg.duration_days,
        },
      },
    });

    return { message: 'Cập nhật thành công.', data: pkg };
  }

  async buyPackage(user: AuthUser, packageId: number) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có thể mua gói.');

    const pkg = await this.prisma.packages.findUnique({
      where: { package_id: packageId, status: 'ACTIVE', delete_at: null },
    });

    if (!pkg) throw new NotFoundException('Gói tải không khả dụng.');

    const paymentWallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: { customer_id: user.customerId, wallet_type: 'PAYMENT' },
      },
    });

    if (!paymentWallet || paymentWallet.balance.lt(pkg.price)) {
      throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.wallets.update({
        where: { wallet_id: paymentWallet.wallet_id },
        data: { balance: { decrement: pkg.price } },
      });

      const { systemRevenue } = await this.ledger.getSystemWallets(tx);

      await tx.wallets.update({
        where: { wallet_id: systemRevenue.wallet_id },
        data: { balance: { increment: pkg.price } },
      });

      const queuedPackages = await tx.user_packages.findMany({
        where: {
          customer_id: user.customerId!,
          expires_at: { gt: new Date() },
          status: 'ACTIVE',
          turns_remaining: { gt: 0 },
        },
        orderBy: [{ expires_at: 'desc' }, { purchased_at: 'desc' }],
      });

      const now = new Date();
      const lastQueuedPackage = queuedPackages[0];
      const expiryBase =
        lastQueuedPackage && lastQueuedPackage.expires_at > now ? lastQueuedPackage.expires_at : now;
      const nextExpiresAt = new Date(expiryBase);
      nextExpiresAt.setDate(nextExpiresAt.getDate() + pkg.duration_days);

      const userPkg = await tx.user_packages.create({
        data: {
          customer_id: user.customerId!,
          package_id: pkg.package_id,
          turns_remaining: pkg.download_turns,
          expires_at: nextExpiresAt,
          status: 'ACTIVE',
        },
      });

      await this.ledger.recordTransaction(
        tx,
        'PURCHASE',
        'USER_PACKAGE',
        userPkg.user_package_id,
        `Mua gói dịch vụ: ${pkg.name}`,
        [
          { wallet_id: paymentWallet.wallet_id, debit_amount: pkg.price, credit_amount: 0 },
          { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: pkg.price },
        ]
      );

      return {
        userPkg,
        isQueued: queuedPackages.length > 0,
      };
    });

    const customer = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: user.customerId! },
      select: { account_id: true },
    });

    if (customer) {
      await this.notificationsService.createNotification({
        accountId: customer.account_id,
        type: 'PACKAGE_PURCHASED',
        title: 'Mua gói thành công',
        message:
          result.isQueued
            ? `Bạn đã mua thành công gói "${pkg.name}". Gói này sẽ tự kích hoạt sau khi gói hiện tại hết lượt hoặc hết hạn.`
            : `Bạn đã mua thành công gói "${pkg.name}" và gói đã sẵn sàng để sử dụng.`,
        link: '/packages',
        metadata: { packageId: pkg.package_id, userPackageId: result.userPkg.user_package_id },
      });
    }

    return { message: `Mua thành công gói ${pkg.name}.`, data: result.userPkg };
  }

  async deletePackage(id: number, actor: AuthUser) {
    const existing = await this.prisma.packages.findUnique({ where: { package_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói này.');

    await this.prisma.packages.update({
      where: { package_id: id },
      data: { delete_at: new Date() },
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_DELETE_PACKAGE',
        target_table: 'packages',
        target_id: id,
        old_value: { name: existing.name },
      },
    });

    return { message: 'Đã xóa gói dịch vụ thành công.' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpirePackages() {
    this.logger.log('Running daily expire packages job...');
    const result = await this.prisma.user_packages.updateMany({
      where: {
        status: 'ACTIVE',
        expires_at: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(`Expired ${result.count} packages.`);
  }

  @Cron('0 0 1 * *')
  async resetFreeDownloads() {
    this.logger.log('Running monthly reset free downloads job...');
    const result = await this.prisma.customer_profiles.updateMany({
      data: { free_downloads_remaining: 4 },
    });
    this.logger.log(`Reset free downloads for ${result.count} customer profiles.`);
  }
}
