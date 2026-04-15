import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { LedgerService } from './ledger.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export class RequestWithdrawalDto {
  amount!: number;
  bankInfo: any;
}

export class ProcessWithdrawalDto {
  status!: 'PAID' | 'REJECTED';
  note?: string;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  async getMyWallets(user: AuthUser) {
    if (!user.customerId) throw new NotFoundException('Tai khoan khong hop le.');

    const wallets = await this.prisma.wallets.findMany({
      where: { customer_id: user.customerId }
    });
    return toJsonSafe({ data: wallets });
  }

  async getMyWithdrawals(user: AuthUser) {
    if (!user.customerId) return { data: [] };

    const reqs = await this.prisma.withdrawal_requests.findMany({
      where: { customer_id: user.customerId },
      orderBy: { created_at: 'desc' }
    });
    return toJsonSafe({ data: reqs });
  }

  async requestWithdrawal(user: AuthUser, dto: RequestWithdrawalDto) {
    const customerId = user.customerId;
    if (!customerId) throw new NotFoundException('Khong ro khach hang.');

    const wallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: {
          customer_id: customerId,
          wallet_type: 'REVENUE'
        }
      }
    });

    if (!wallet) throw new BadRequestException('Khach hang chua co vi doanh thu.');

    const amount = new Prisma.Decimal(dto.amount);
    if (wallet.balance.lt(amount)) {
      throw new BadRequestException('So du kha dung khong du de thuc hien lenh rut tien.');
    }

    const configs = await this.prisma.configs.findMany({
      where: { config_key: { in: ['MIN_WITHDRAWAL', 'WITHDRAWAL_FEE_RATE'] } }
    });
    const configMap = new Map(configs.map((c) => [c.config_key, c.config_value]));

    const minAmount = new Prisma.Decimal(configMap.get('MIN_WITHDRAWAL') ?? '100000');
    if (amount.lt(minAmount)) {
      throw new BadRequestException('So tien rut thap hon muc toi thieu (' + minAmount.toString() + ').');
    }

    const taxRate = new Prisma.Decimal(configMap.get('WITHDRAWAL_FEE_RATE') ?? '0.0');
    const taxAmount = amount.mul(taxRate);
    const netAmount = amount.sub(taxAmount);

    const created = await this.prisma.$transaction(async (tx) => {
      const { gatewayPool, systemRevenue } = await this.ledger.getSystemWallets(tx);

      const updatedWallet = await tx.wallets.update({
        where: { wallet_id: wallet.wallet_id },
        data: {
          balance: wallet.balance.sub(amount)
        }
      });

      const request = await tx.withdrawal_requests.create({
        data: {
          customer_id: customerId,
          amount,
          tax_amount: taxAmount,
          net_amount: netAmount,
          status: 'PENDING',
          bank_info: dto.bankInfo as Prisma.InputJsonValue
        }
      });

      // Credit system wallets directly as part of withdrawal liability 
      await tx.wallets.update({
        where: { wallet_id: gatewayPool.wallet_id },
        data: { balance: { increment: netAmount } } // GATEWAY owes user bank
      });
      await tx.wallets.update({
        where: { wallet_id: systemRevenue.wallet_id },
        data: { balance: { increment: taxAmount } } // SYSTEM keeps tax
      });

      await this.ledger.recordTransaction(
        tx,
        'WITHDRAW',
        'WITHDRAWAL_REQUEST',
        request.request_id,
        'Lenh rut tien dang cho duyet',
        [
          { wallet_id: wallet.wallet_id, debit_amount: amount, credit_amount: 0 },
          { wallet_id: gatewayPool.wallet_id, debit_amount: 0, credit_amount: netAmount },
          { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: taxAmount }
        ]
      );

      return request;
    });

    return toJsonSafe(created);
  }

  async processWithdrawal(actor: AuthUser, requestId: string, dto: ProcessWithdrawalDto) {
    const id = Number(requestId);

    const request = await this.prisma.withdrawal_requests.findUnique({ where: { request_id: id } });
    if (!request) throw new NotFoundException('Khong tim thay lenh rut tien.');

    if (!['PENDING'].includes(request.status)) {
      throw new BadRequestException('Lenh rut tien da duoc xu ly hoac khong hop le.');
    }

    const wallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: {
          customer_id: request.customer_id,
          wallet_type: 'REVENUE'
        }
      }
    });
    
    if (!wallet) throw new NotFoundException('Khong tim thay vi lien quan.');

    const nextStatus = dto.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const { gatewayPool, systemRevenue } = await this.ledger.getSystemWallets(tx);

      const updatedRequest = await tx.withdrawal_requests.update({
        where: { request_id: id },
        data: {
          status: nextStatus,
          accountant_id: actor.staffId ? Number(actor.staffId) : undefined,
          updated_at: new Date()
        }
      });

      if (nextStatus === 'REJECTED') {
        const restoredWallet = await tx.wallets.update({
          where: { wallet_id: wallet.wallet_id },
          data: { balance: wallet.balance.add(request.amount) }
        });

        await tx.wallets.update({
          where: { wallet_id: gatewayPool.wallet_id },
          data: { balance: { decrement: request.net_amount } }
        });
        await tx.wallets.update({
          where: { wallet_id: systemRevenue.wallet_id },
          data: { balance: { decrement: request.tax_amount } }
        });

        await this.ledger.recordTransaction(
          tx,
          'REFUND',
          'WITHDRAWAL_REQUEST',
          id,
          'Hoan tien rut that bai',
          [
            { wallet_id: gatewayPool.wallet_id, debit_amount: request.net_amount, credit_amount: 0 },
            { wallet_id: systemRevenue.wallet_id, debit_amount: request.tax_amount, credit_amount: 0 },
            { wallet_id: wallet.wallet_id, debit_amount: 0, credit_amount: request.amount }
          ]
        );
      }

      return updatedRequest;
    });

    return toJsonSafe(result);
  }

  async releaseHeldFunds() {
    const now = new Date();
    const heldItems = await this.prisma.order_items.findMany({
      where: {
        status: 'HELD',
        hold_until: { lte: now }
      }
    });

    if (heldItems.length === 0) {
      return { releasedCount: 0 };
    }



    await this.prisma.$transaction(async (tx) => {
      for (const item of heldItems) {
        const wallet = await tx.wallets.findUnique({
          where: {
            customer_id_wallet_type: {
              customer_id: item.seller_id,
              wallet_type: 'REVENUE'
            }
          }
        });
        if (!wallet) continue;

        const nextPending = wallet.pending_balance.sub(item.seller_earning);
        const nextBalance = wallet.balance.add(item.seller_earning);

        await tx.wallets.update({
          where: { wallet_id: wallet.wallet_id },
          data: {
            pending_balance: nextPending,
            balance: nextBalance
          }
        });

        await tx.order_items.update({
          where: { order_item_id: item.order_item_id },
          data: { status: 'RELEASED' }
        });
      }
    });

    console.log(`[Cron] Đã release thành công ${heldItems.length} khoản tiền bị hold vào số dư khả dụng.`);

    return { releasedCount: heldItems.length };
  }

  // 5.5 Cronjob release tiền: Kiểm tra hold_until < NOW() -> chuyển pending_balance -> balance
  @Cron(CronExpression.EVERY_HOUR)
  async handleReleaseHeldFunds() {
    console.log('[Cron] Running hourly release held funds...');
    await this.releaseHeldFunds();
  }

  async getLedgerHistory(user: AuthUser) {
    if (!user.customerId) throw new BadRequestException('Khong phai khach hang.');

    const wallets = await this.prisma.wallets.findMany({
      where: { customer_id: user.customerId }
    });

    const walletIds = wallets.map((w: any) => w.wallet_id);

    // Find all ledger entries for these wallets, then include the parent transaction
    const entries = await this.prisma.ledger_entries.findMany({
      where: { wallet_id: { in: walletIds } },
      include: {
        ledger_transactions: true,
        wallets: true
      },
      orderBy: { created_at: 'desc' }
    });

    return toJsonSafe(
      entries.map(e => ({
        entryId: e.id,
        walletType: e.wallets.wallet_type,
        debit: Number(e.debit_amount),
        credit: Number(e.credit_amount),
        createdAt: e.created_at,
        transaction: {
          id: e.ledger_transactions.id,
          type: e.ledger_transactions.type,
          description: e.ledger_transactions.description,
          status: e.ledger_transactions.status,
          referenceType: e.ledger_transactions.reference_type,
          referenceId: e.ledger_transactions.reference_id
        }
      }))
    );
  }
}
