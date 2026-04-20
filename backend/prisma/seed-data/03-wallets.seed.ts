import { PrismaClient } from '@prisma/client';

/**
 * Phase 3: Cập nhật số dư wallets (sau khi accounts đã tạo wallets với balance=0)
 * Số dư được tính chính xác từ ledger plan:
 * 
 * GATEWAY_POOL:  +1,100,000 (3 topup)
 * SYSTEM_REVENUE: +111,000 (81k commission + 30k package)
 * seller1.PAY: 200,000 | seller1.REV: bal=20,000 pending=27,500
 * seller2.PAY: 0       | seller2.REV: bal=10,000 pending=23,500
 * buyer1.PAY:  398,000  | buyer2.PAY:  310,000
 */
export async function seedWallets(prisma: PrismaClient) {
  console.log('\n💰 Phase 3: Wallet balances...');

  // Helper: tìm wallet theo email + type
  async function updateWallet(email: string, walletType: string, balance: number, pending: number) {
    const account = await prisma.accounts.findUnique({
      where: { email },
      include: { customer_profiles: true },
    });
    if (!account?.customer_profiles) return;

    await prisma.wallets.update({
      where: {
        customer_id_wallet_type: {
          customer_id: account.customer_profiles.customer_id,
          wallet_type: walletType as any,
        },
      },
      data: { balance, pending_balance: pending },
    });
  }

  // System wallets
  const gateway = await prisma.wallets.findFirst({ where: { wallet_type: 'GATEWAY_POOL' } });
  const sysRev = await prisma.wallets.findFirst({ where: { wallet_type: 'SYSTEM_REVENUE' } });
  const taxPay = await prisma.wallets.findFirst({ where: { wallet_type: 'TAX_PAYABLE' } });

  if (gateway) await prisma.wallets.update({ where: { wallet_id: gateway.wallet_id }, data: { balance: 1100000 } });
  if (sysRev) await prisma.wallets.update({ where: { wallet_id: sysRev.wallet_id }, data: { balance: 111000 } });
  if (taxPay) await prisma.wallets.update({ where: { wallet_id: taxPay.wallet_id }, data: { balance: 0 } });

  // User wallets
  await updateWallet('seller1@gmail.com', 'PAYMENT', 200000, 0);
  await updateWallet('seller1@gmail.com', 'REVENUE', 20000, 27500);
  await updateWallet('seller2@gmail.com', 'PAYMENT', 0, 0);
  await updateWallet('seller2@gmail.com', 'REVENUE', 10000, 23500);
  await updateWallet('buyer1@gmail.com', 'PAYMENT', 398000, 0);
  await updateWallet('buyer1@gmail.com', 'REVENUE', 0, 0);
  await updateWallet('buyer2@gmail.com', 'PAYMENT', 310000, 0);
  await updateWallet('buyer2@gmail.com', 'REVENUE', 0, 0);
  await updateWallet('testbanned@gmail.com', 'PAYMENT', 0, 0);
  await updateWallet('testbanned@gmail.com', 'REVENUE', 0, 0);

  console.log('  ✅ System wallets updated (GATEWAY=1,100,000 | SYS_REV=111,000)');
  console.log('  ✅ User wallets updated (10 wallets)');
}
