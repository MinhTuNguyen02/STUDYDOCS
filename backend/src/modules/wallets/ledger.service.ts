import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma, ledger_transaction_type } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) { }

  async getSystemWallets(tx: any) { // Có thể thay 'any' bằng 'Prisma.TransactionClient' nếu bạn đã import Prisma
    // 1. Tìm trực tiếp ví GATEWAY_POOL (customer_id đang là null)
    const gatewayPool = await tx.wallets.findFirst({
      where: {
        wallet_type: 'GATEWAY_POOL'
      }
    });

    // 2. Tìm trực tiếp ví SYSTEM_REVENUE (customer_id đang là null)
    const systemRevenue = await tx.wallets.findFirst({
      where: {
        wallet_type: 'SYSTEM_REVENUE'
      }
    });

    // 3. Bắt lỗi chi tiết nếu lỡ mất ví
    if (!gatewayPool || !systemRevenue) {
      throw new InternalServerErrorException(
        `System wallets missing! GATEWAY_POOL: ${!!gatewayPool}, SYSTEM_REVENUE: ${!!systemRevenue}.`
      );
    }

    return { gatewayPool, systemRevenue };
  }

  async recordTransaction(
    tx: any,
    type: ledger_transaction_type,
    referenceType: string,
    referenceId: number,
    description: string,
    entries: { wallet_id: number; debit_amount: number | Prisma.Decimal; credit_amount: number | Prisma.Decimal }[]
  ) {
    let totalDebit = 0;
    let totalCredit = 0;

    for (const en of entries) {
      totalDebit += Number(en.debit_amount);
      totalCredit += Number(en.credit_amount);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new InternalServerErrorException(`Double-entry mismatch! Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    const ledgerTxn = await tx.ledger_transactions.create({
      data: {
        type,
        reference_type: referenceType,
        reference_id: referenceId,
        status: 'COMPLETED',
        description
      }
    });

    for (const entry of entries) {
      await tx.ledger_entries.create({
        data: {
          transaction_id: ledgerTxn.id,
          wallet_id: entry.wallet_id,
          debit_amount: entry.debit_amount,
          credit_amount: entry.credit_amount
        }
      });
    }

    return ledgerTxn;
  }
}
