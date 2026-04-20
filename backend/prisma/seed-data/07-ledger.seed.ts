import { PrismaClient } from '@prisma/client';

/**
 * Phase 7: Ledger Transactions + Entries (SỔ KÉP)
 * 9 transactions, 25 entries
 * MỌI transaction: ∑Debit = ∑Credit
 */
export async function seedLedger(prisma: PrismaClient) {
  console.log('\n📒 Phase 7: Ledger (double-entry)...');

  // Kiểm tra đã seed chưa
  const existing = await prisma.ledger_transactions.count();
  if (existing > 0) {
    console.log('  ⏭️ Ledger đã tồn tại, bỏ qua.');
    return;
  }

  // ── Lấy wallet IDs ──
  async function getWalletId(email: string, type: string): Promise<number> {
    const acc = await prisma.accounts.findUnique({ where: { email }, include: { customer_profiles: true } });
    if (!acc?.customer_profiles) throw new Error(`Customer ${email} not found`);
    const w = await prisma.wallets.findUnique({
      where: { customer_id_wallet_type: { customer_id: acc.customer_profiles.customer_id, wallet_type: type as any } },
    });
    if (!w) throw new Error(`Wallet not found: ${email} / ${type}`);
    return w.wallet_id;
  }

  const gateway = await prisma.wallets.findFirst({ where: { wallet_type: 'GATEWAY_POOL' } });
  const sysRev = await prisma.wallets.findFirst({ where: { wallet_type: 'SYSTEM_REVENUE' } });
  if (!gateway || !sysRev) throw new Error('System wallets missing');

  const GW = gateway.wallet_id;
  const SR = sysRev.wallet_id;
  const s1Pay = await getWalletId('seller1@gmail.com', 'PAYMENT');
  const s1Rev = await getWalletId('seller1@gmail.com', 'REVENUE');
  const s2Rev = await getWalletId('seller2@gmail.com', 'REVENUE');
  const b1Pay = await getWalletId('buyer1@gmail.com', 'PAYMENT');
  const b2Pay = await getWalletId('buyer2@gmail.com', 'PAYMENT');

  // Lấy payment + order IDs
  const payments = await prisma.payments.findMany({ orderBy: { created_at: 'asc' }, take: 3 });
  const orders = await prisma.orders.findMany({ orderBy: { created_at: 'asc' }, take: 5 });

  // Lấy user_package ID (sẽ tạo ở phase sau, dùng placeholder 0 rồi update)
  // Thực tế tạo user_package ở đây luôn để có reference_id
  const buyer1Acc = await prisma.accounts.findUnique({ where: { email: 'buyer1@gmail.com' }, include: { customer_profiles: true } });
  const pkg = await prisma.packages.findFirst({ where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } });

  let userPkgId = 0;
  if (buyer1Acc?.customer_profiles && pkg) {
    const existingPkg = await prisma.user_packages.findFirst({
      where: { customer_id: buyer1Acc.customer_profiles.customer_id },
    });
    if (!existingPkg) {
      const up = await prisma.user_packages.create({
        data: {
          customer_id: buyer1Acc.customer_profiles.customer_id,
          package_id: pkg.package_id,
          turns_remaining: 8,
          status: 'ACTIVE',
          purchased_at: new Date('2026-04-14T10:00:00+07:00'),
          expires_at: new Date('2026-05-14T10:00:00+07:00'),
        },
      });
      userPkgId = up.user_package_id;
      console.log('  ✅ User Package (buyer1 → Gói Tiêu chuẩn)');
    }
  }

  // ── Helper: tạo transaction + entries, validate balance ──
  async function createTx(
    type: 'DEPOSIT' | 'PURCHASE' | 'WITHDRAW' | 'REFUND',
    refType: string,
    refId: number,
    desc: string,
    entries: { wallet_id: number; debit: number; credit: number }[],
    createdAt: Date,
  ) {
    const totalD = entries.reduce((s, e) => s + e.debit, 0);
    const totalC = entries.reduce((s, e) => s + e.credit, 0);
    if (Math.abs(totalD - totalC) > 0.01) {
      throw new Error(`❌ Sổ kép lệch! D=${totalD} C=${totalC} — ${desc}`);
    }

    const tx = await prisma.ledger_transactions.create({
      data: {
        type, reference_type: refType, reference_id: refId,
        status: 'COMPLETED', description: desc, created_at: createdAt,
      },
    });

    for (const e of entries) {
      await prisma.ledger_entries.create({
        data: {
          transaction_id: tx.id,
          wallet_id: e.wallet_id,
          debit_amount: e.debit,
          credit_amount: e.credit,
          created_at: createdAt,
        },
      });
    }
  }

  // ── TX1: Deposit buyer1 500k ──
  await createTx('DEPOSIT', 'PAYMENT', payments[0]?.payment_id ?? 0,
    'Nạp tiền buyer1 qua VNPay', [
      { wallet_id: GW, debit: 500000, credit: 0 },
      { wallet_id: b1Pay, debit: 0, credit: 500000 },
    ], new Date('2026-04-04T08:00:00+07:00'));

  // ── TX2: Deposit buyer2 400k ──
  await createTx('DEPOSIT', 'PAYMENT', payments[1]?.payment_id ?? 0,
    'Nạp tiền buyer2 qua VNPay', [
      { wallet_id: GW, debit: 400000, credit: 0 },
      { wallet_id: b2Pay, debit: 0, credit: 400000 },
    ], new Date('2026-04-04T09:00:00+07:00'));

  // ── TX3: Deposit seller1 200k ──
  await createTx('DEPOSIT', 'PAYMENT', payments[2]?.payment_id ?? 0,
    'Nạp tiền seller1 qua VNPay', [
      { wallet_id: GW, debit: 200000, credit: 0 },
      { wallet_id: s1Pay, debit: 0, credit: 200000 },
    ], new Date('2026-04-04T10:00:00+07:00'));

  // ── TX4: Order#1 40k (buyer1 → seller1) ──
  await createTx('PURCHASE', 'ORDER', orders[0]?.order_id ?? 0,
    'Thanh toán đơn hàng #1', [
      { wallet_id: b1Pay, debit: 40000, credit: 0 },
      { wallet_id: s1Rev, debit: 0, credit: 20000 },
      { wallet_id: SR, debit: 0, credit: 20000 },
    ], new Date('2026-04-05T10:00:00+07:00'));

  // ── TX5: Order#2 20k (buyer1 → seller2) ──
  await createTx('PURCHASE', 'ORDER', orders[1]?.order_id ?? 0,
    'Thanh toán đơn hàng #2', [
      { wallet_id: b1Pay, debit: 20000, credit: 0 },
      { wallet_id: s2Rev, debit: 0, credit: 10000 },
      { wallet_id: SR, debit: 0, credit: 10000 },
    ], new Date('2026-04-06T14:00:00+07:00'));

  // ── TX6: Order#3 65k (buyer2 → seller1+seller2) ──
  await createTx('PURCHASE', 'ORDER', orders[2]?.order_id ?? 0,
    'Thanh toán đơn hàng #3', [
      { wallet_id: b2Pay, debit: 65000, credit: 0 },
      { wallet_id: s1Rev, debit: 0, credit: 15000 },
      { wallet_id: s2Rev, debit: 0, credit: 17500 },
      { wallet_id: SR, debit: 0, credit: 32500 },
    ], new Date('2026-04-10T09:00:00+07:00'));

  // ── TX7: Order#4 25k (buyer2 → seller1) ──
  await createTx('PURCHASE', 'ORDER', orders[3]?.order_id ?? 0,
    'Thanh toán đơn hàng #4', [
      { wallet_id: b2Pay, debit: 25000, credit: 0 },
      { wallet_id: s1Rev, debit: 0, credit: 12500 },
      { wallet_id: SR, debit: 0, credit: 12500 },
    ], new Date('2026-04-15T11:00:00+07:00'));

  // ── TX8: Order#5 12k (buyer1 → seller2) ──
  await createTx('PURCHASE', 'ORDER', orders[4]?.order_id ?? 0,
    'Thanh toán đơn hàng #5', [
      { wallet_id: b1Pay, debit: 12000, credit: 0 },
      { wallet_id: s2Rev, debit: 0, credit: 6000 },
      { wallet_id: SR, debit: 0, credit: 6000 },
    ], new Date('2026-04-16T16:00:00+07:00'));

  // ── TX9: Package purchase 30k (buyer1 → system) ──
  await createTx('PURCHASE', 'USER_PACKAGE', userPkgId,
    'Mua gói dịch vụ: Gói Tiêu chuẩn', [
      { wallet_id: b1Pay, debit: 30000, credit: 0 },
      { wallet_id: SR, debit: 0, credit: 30000 },
    ], new Date('2026-04-14T10:00:00+07:00'));

  console.log('  ✅ Ledger: 9 transactions, 25 entries (all balanced ∑D=∑C)');
}
