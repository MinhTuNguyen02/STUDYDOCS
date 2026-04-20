import { PrismaClient } from '@prisma/client';

/**
 * Phase 6: Orders + Order Items + Payments
 * Commission = 50%, Hold = 48h
 * 
 * Order 1: buyer1 mua doc1+doc2 (seller1) = 40k
 * Order 2: buyer1 mua doc4 (seller2) = 20k
 * Order 3: buyer2 mua doc3(seller1)+doc5(seller2) = 65k
 * Order 4: buyer2 mua doc1 (seller1) = 25k
 * Order 5: buyer1 mua doc9 (seller2) = 12k
 */
export async function seedOrders(prisma: PrismaClient) {
  console.log('\n🛒 Phase 6: Orders + Order Items + Payments...');

  // Helper: lấy customer_id từ email
  async function getCustId(email: string): Promise<number> {
    const acc = await prisma.accounts.findUnique({ where: { email }, include: { customer_profiles: true } });
    if (!acc?.customer_profiles) throw new Error(`Customer ${email} not found`);
    return acc.customer_profiles.customer_id;
  }

  // Helper: lấy document_id từ slug
  async function getDocId(slug: string): Promise<number> {
    const doc = await prisma.documents.findUnique({ where: { slug } });
    if (!doc) throw new Error(`Document "${slug}" not found`);
    return doc.document_id;
  }

  // Helper: lấy wallet_id
  async function getWalletId(custId: number, type: string): Promise<number> {
    const w = await prisma.wallets.findUnique({
      where: { customer_id_wallet_type: { customer_id: custId, wallet_type: type as any } },
    });
    if (!w) throw new Error(`Wallet ${type} for customer ${custId} not found`);
    return w.wallet_id;
  }

  const buyer1 = await getCustId('buyer1@gmail.com');
  const buyer2 = await getCustId('buyer2@gmail.com');
  const seller1 = await getCustId('seller1@gmail.com');
  const seller2 = await getCustId('seller2@gmail.com');

  const doc1 = await getDocId('giao-trinh-python-co-ban');
  const doc2 = await getDocId('de-thi-csdl-hk1-2025');
  const doc3 = await getDocId('tong-hop-ngu-phap-toeic');
  const doc4 = await getDocId('giao-trinh-luat-dan-su-vn');
  const doc5 = await getDocId('atlas-giai-phau-y-khoa');
  const doc9 = await getDocId('slide-marketing-can-ban');

  // Kiểm tra đã seed chưa
  const existingOrders = await prisma.orders.count({ where: { buyer_id: { in: [buyer1, buyer2] } } });
  if (existingOrders > 0) {
    console.log('  ⏭️ Orders đã tồn tại, bỏ qua.');
    return;
  }

  // ── Payments (topup trước khi mua) ──
  const buyer1WalletId = await getWalletId(buyer1, 'PAYMENT');
  const buyer2WalletId = await getWalletId(buyer2, 'PAYMENT');
  const seller1WalletId = await getWalletId(seller1, 'PAYMENT');

  await prisma.payments.createMany({
    data: [
      {
        provider: 'VNPAY', purpose: 'WALLET_TOPUP', amount: 500000, status: 'COMPLETED',
        wallet_id: buyer1WalletId, provider_txn_id: 'VNP-SEED-001',
        request_payload: { customerId: buyer1, txnRef: 'TOPUP-SEED-1' },
        created_at: new Date('2026-04-04T08:00:00+07:00'),
      },
      {
        provider: 'VNPAY', purpose: 'WALLET_TOPUP', amount: 400000, status: 'COMPLETED',
        wallet_id: buyer2WalletId, provider_txn_id: 'VNP-SEED-002',
        request_payload: { customerId: buyer2, txnRef: 'TOPUP-SEED-2' },
        created_at: new Date('2026-04-04T09:00:00+07:00'),
      },
      {
        provider: 'VNPAY', purpose: 'WALLET_TOPUP', amount: 200000, status: 'COMPLETED',
        wallet_id: seller1WalletId, provider_txn_id: 'VNP-SEED-003',
        request_payload: { customerId: seller1, txnRef: 'TOPUP-SEED-3' },
        created_at: new Date('2026-04-04T10:00:00+07:00'),
      },
    ],
  });
  console.log('  ✅ Payments (3 topup)');

  // ── Orders + Order Items ──
  const ordersData = [
    {
      buyerId: buyer1, total: 40000, createdAt: '2026-04-05T10:00:00+07:00',
      items: [
        { docId: doc1, sellerId: seller1, price: 25000, status: 'RELEASED' as const, holdPast: true },
        { docId: doc2, sellerId: seller1, price: 15000, status: 'RELEASED' as const, holdPast: true },
      ],
    },
    {
      buyerId: buyer1, total: 20000, createdAt: '2026-04-06T14:00:00+07:00',
      items: [
        { docId: doc4, sellerId: seller2, price: 20000, status: 'RELEASED' as const, holdPast: true },
      ],
    },
    {
      buyerId: buyer2, total: 65000, createdAt: '2026-04-10T09:00:00+07:00',
      items: [
        { docId: doc3, sellerId: seller1, price: 30000, status: 'HELD' as const, holdPast: false },
        { docId: doc5, sellerId: seller2, price: 35000, status: 'HELD' as const, holdPast: false },
      ],
    },
    {
      buyerId: buyer2, total: 25000, createdAt: '2026-04-15T11:00:00+07:00',
      items: [
        { docId: doc1, sellerId: seller1, price: 25000, status: 'HELD' as const, holdPast: false },
      ],
    },
    {
      buyerId: buyer1, total: 12000, createdAt: '2026-04-16T16:00:00+07:00',
      items: [
        { docId: doc9, sellerId: seller2, price: 12000, status: 'HELD' as const, holdPast: false },
      ],
    },
  ];

  for (const od of ordersData) {
    const order = await prisma.orders.create({
      data: {
        buyer_id: od.buyerId,
        total_amount: od.total,
        status: 'PAID',
        created_at: new Date(od.createdAt),
        updated_at: new Date(od.createdAt),
      },
    });

    for (const item of od.items) {
      const commissionFee = item.price * 0.5;
      const sellerEarning = item.price - commissionFee;
      const holdUntil = item.holdPast
        ? new Date(new Date(od.createdAt).getTime() + 48 * 60 * 60 * 1000) // quá khứ → RELEASED
        : new Date('2026-04-25T00:00:00+07:00'); // tương lai → HELD

      await prisma.order_items.create({
        data: {
          order_id: order.order_id,
          document_id: item.docId,
          seller_id: item.sellerId,
          unit_price: item.price,
          commission_fee: commissionFee,
          seller_earning: sellerEarning,
          status: item.status,
          hold_until: holdUntil,
          created_at: new Date(od.createdAt),
          updated_at: new Date(od.createdAt),
        },
      });
    }
  }
  console.log('  ✅ Orders (5) + Order Items (7)');
}
