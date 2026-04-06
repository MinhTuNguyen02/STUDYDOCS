import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { LedgerService } from '../wallets/ledger.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

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

  async createPackage(dto: any) {
    const pkg = await this.prisma.packages.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        download_turns: dto.downloadTurns,
        duration_days: dto.durationDays ?? 30,
        status: dto.status ?? 'ACTIVE'
      }
    });
    return { message: 'Tạo gói tải thành công.', data: pkg };
  }

  async updatePackage(id: number, dto: any) {
    const existing = await this.prisma.packages.findUnique({ where: { package_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói này.');

    const pkg = await this.prisma.packages.update({
      where: { package_id: id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        download_turns: dto.downloadTurns,
        duration_days: dto.durationDays,
        status: dto.status
      }
    });

    return { message: 'Cập nhật thành công.', data: pkg };
  }

  async buyPackage(user: AuthUser, packageId: number) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có thể mua gói.');

    const pkg = await this.prisma.packages.findUnique({
      where: { package_id: packageId, status: 'ACTIVE', delete_at: null }
    });

    if (!pkg) throw new NotFoundException('Gói tải không khả dụng.');

    const paymentWallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: { customer_id: user.customerId, wallet_type: 'PAYMENT' }
      }
    });

    if (!paymentWallet || paymentWallet.balance.lt(pkg.price)) {
      throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pkg.duration_days);

    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.wallets.update({
        where: { wallet_id: paymentWallet.wallet_id },
        data: { balance: { decrement: pkg.price } }
      });

      // Get system wallets for double-entry
      const { systemRevenue } = await this.ledger.getSystemWallets(tx);

      // Create package
      const userPkg = await tx.user_packages.create({
        data: {
          customer_id: user.customerId!,
          package_id: pkg.package_id,
          turns_remaining: pkg.download_turns,
          expires_at: expiresAt,
          status: 'ACTIVE'
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
    });

    return { message: `Mua thành công gói ${pkg.name}.`, data: result };
  }

  async deletePackage(id: number) {
    const existing = await this.prisma.packages.findUnique({ where: { package_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói này.');
    
    await this.prisma.packages.update({
      where: { package_id: id },
      data: { delete_at: new Date() }
    });

    return { message: 'Đã xóa gói dịch vụ thành công.' };
  }

  // 6.8 Cronjob expire gói
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpirePackages() {
    this.logger.log('Running daily expire packages job...');
    const result = await this.prisma.user_packages.updateMany({
      where: { 
        status: 'ACTIVE', 
        expires_at: { lt: new Date() } 
      },
      // Since 'EXPIRED' might be the status from the checklist
      data: { status: 'EXPIRED' }
    });
    this.logger.log(`Expired ${result.count} packages.`);
  }

  // 6.7 Cronjob reset lượt tải miễn phí
  @Cron('0 0 1 * *') // Đầu mỗi tháng
  async resetFreeDownloads() {
    this.logger.log('Running monthly reset free downloads job...');
    const result = await this.prisma.customer_profiles.updateMany({
      data: { free_downloads_remaining: 4 }
    });
    this.logger.log(`Reset free downloads for ${result.count} customer profiles.`);
  }
}
