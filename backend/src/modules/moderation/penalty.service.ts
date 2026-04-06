import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../wallets/ledger.service';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

@Injectable()
export class PenaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  // Automatically count violations and apply actions
  async evaluateUserViolations(customerId: number) {
    const profile = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: customerId }
    });

    if (!profile) return;

    // Count UPLOAD_VIOLATION in audit_logs for this accountId
    const violationCount = await this.prisma.audit_logs.count({
      where: {
        account_id: profile.account_id,
        action: 'UPLOAD_VIOLATION'
      }
    });

    if (violationCount === 3) {
      // Third violation: Deduct 50,000 from REVENUE wallet as fine
      await this.applyFine(profile.account_id, customerId, 50000, 'Phat 50,000 VND do vi pham ban quyen nhieu lan.');
    } else if (violationCount >= 5) {
      // Fifth violation: Block account
      await this.prisma.accounts.update({
        where: { account_id: profile.account_id },
        data: { status: 'BANNED' }
      });
      await this.prisma.user_sessions.updateMany({
        where: { account_id: profile.account_id, is_revoked: false },
        data: { is_revoked: true }
      });
      console.log(`[PenaltyService] Banned user ${profile.account_id} due to 5 violations.`);
    }
  }

  async applyFine(accountId: number, customerId: number, amount: number, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const { systemRevenue } = await this.ledger.getSystemWallets(tx);

      const sellerWallet = await tx.wallets.findUnique({
        where: { customer_id_wallet_type: { customer_id: customerId, wallet_type: 'REVENUE' } }
      });

      if (!sellerWallet) {
        throw new BadRequestException('Khong tim thay vi REVENUE cua user de phat.');
      }

      const fineAmount = new Prisma.Decimal(amount);
      const debitAmount = Prisma.Decimal.min(sellerWallet.balance, fineAmount);

      if (debitAmount.gt(0)) {
        await tx.wallets.update({
          where: { wallet_id: sellerWallet.wallet_id },
          data: { balance: { decrement: debitAmount } }
        });

        await tx.wallets.update({
          where: { wallet_id: systemRevenue.wallet_id },
          data: { balance: { increment: debitAmount } }
        });

        // Add ledger record: type WITHDRAW/REFUND equivalent, let's use REFUND or a custom type if exists, but schema enum has PURCHASE | WITHDRAW | DEPOSIT | REFUND.
        // Penalty is effectively a system "REFUND" or "WITHDRAW" taking from seller to system. Let's use WITHDRAW.
        await this.ledger.recordTransaction(
          tx,
          'WITHDRAW',
          'PENALTY',
          sellerWallet.wallet_id,
          reason,
          [
            { wallet_id: sellerWallet.wallet_id, debit_amount: debitAmount, credit_amount: 0 },
            { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: debitAmount }
          ]
        );
      }

      await tx.audit_logs.create({
        data: {
          account_id: accountId,
          action: 'PENALTY_APPLIED',
          target_table: 'wallets',
          target_id: sellerWallet.wallet_id,
          old_value: { balance: sellerWallet.balance },
          new_value: { reason, amountFined: debitAmount }
        }
      });
    });
  }

  // Callable by Moderation or Admin
  async manualPenalty(actor: AuthUser, targetCustomerId: number, amount: number, reason: string) {
    const profile = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: targetCustomerId }
    });
    if (!profile) throw new BadRequestException('Khach hang khong hop le.');
    
    await this.applyFine(profile.account_id, targetCustomerId, amount, reason);
    return { message: 'Da xu phat thanh cong.' };
  }
}
