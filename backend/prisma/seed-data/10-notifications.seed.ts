import { PrismaClient } from '@prisma/client';

/**
 * Phase 10: Notifications (6 mẫu thực tế)
 */
export async function seedNotifications(prisma: PrismaClient) {
  console.log('\n🔔 Phase 10: Notifications...');

  const existing = await prisma.notifications.count();
  if (existing > 0) {
    console.log('  ⏭️ Notifications đã tồn tại, bỏ qua.');
    return;
  }

  async function getAccId(email: string) {
    const acc = await prisma.accounts.findUnique({ where: { email } });
    return acc!.account_id;
  }

  const seller1Acc = await getAccId('seller1@gmail.com');
  const seller2Acc = await getAccId('seller2@gmail.com');
  const buyer1Acc = await getAccId('buyer1@gmail.com');
  const modAcc = await getAccId('mod@studydocs.vn');
  const adminAcc = await getAccId('admin@studydocs.vn');

  const orders = await prisma.orders.findMany({ orderBy: { created_at: 'asc' }, take: 3 });
  const payments = await prisma.payments.findMany({ orderBy: { created_at: 'asc' }, take: 1 });

  await prisma.notifications.createMany({
    data: [
      {
        account_id: seller1Acc, type: 'ORDER_NEW', title: 'Có đơn hàng mới',
        message: `Tài liệu "Giáo trình Python cơ bản", "Đề thi CSDL HK1 2025" vừa được mua. Đơn hàng #${orders[0]?.order_id ?? 1}.`,
        reference_id: orders[0]?.order_id ?? 1, reference_type: 'ORDER', is_read: true,
        created_at: new Date('2026-04-05T10:01:00+07:00'),
      },
      {
        account_id: seller1Acc, type: 'FUNDS_RELEASED', title: 'Tiền đã được giải phóng',
        message: '20,000đ đã chuyển từ số dư chờ sang khả dụng (2 đơn hàng).',
        reference_type: 'ORDER', is_read: false,
        created_at: new Date('2026-04-07T10:01:00+07:00'),
      },
      {
        account_id: seller2Acc, type: 'ORDER_NEW', title: 'Có đơn hàng mới',
        message: `Tài liệu "Giáo trình Luật dân sự Việt Nam" vừa được mua. Đơn hàng #${orders[1]?.order_id ?? 2}.`,
        reference_id: orders[1]?.order_id ?? 2, reference_type: 'ORDER', is_read: false,
        created_at: new Date('2026-04-06T14:01:00+07:00'),
      },
      {
        account_id: buyer1Acc, type: 'TOPUP_SUCCESS', title: 'Nạp tiền thành công',
        message: 'Bạn đã nạp thành công 500,000đ vào ví thanh toán.',
        reference_id: payments[0]?.payment_id ?? 1, reference_type: 'PAYMENT', is_read: true,
        created_at: new Date('2026-04-04T08:01:00+07:00'),
      },
      {
        account_id: modAcc, type: 'DOC_PENDING', title: 'Tài liệu chờ duyệt',
        message: 'Tài liệu mới "Kanji N4 tổng hợp" đang chờ được kiểm duyệt.',
        reference_type: 'DOCUMENT', is_read: false,
        created_at: new Date('2026-04-12T09:00:00+07:00'),
      },
      {
        account_id: adminAcc, type: 'REPORT_NEW', title: 'Báo cáo vi phạm mới',
        message: 'Report mới: "Tài liệu này sao chép từ sách giáo khoa..." cho tài liệu "Giáo trình Luật dân sự Việt Nam".',
        reference_type: 'REPORT', is_read: false,
        created_at: new Date('2026-04-17T10:00:00+07:00'),
      },
    ],
  });

  console.log('  ✅ Notifications (6)');

  // ── FINAL VALIDATION ──
  console.log('\n🔍 Validation...');

  // Check download_count consistency
  const docs = await prisma.documents.findMany({ select: { document_id: true, title: true, download_count: true } });
  let dlValid = true;
  for (const doc of docs) {
    const actual = await prisma.download_history.count({ where: { document_id: doc.document_id } });
    if (actual !== doc.download_count) {
      console.error(`  ❌ doc#${doc.document_id} "${doc.title}": download_count=${doc.download_count} but history=${actual}`);
      dlValid = false;
    }
  }
  if (dlValid) console.log('  ✅ download_count khớp download_history cho tất cả documents');

  // Check ledger balance
  const txs = await prisma.ledger_transactions.findMany({ include: { ledger_entries: true } });
  let ledgerValid = true;
  for (const tx of txs) {
    const totalD = tx.ledger_entries.reduce((s, e) => s + Number(e.debit_amount), 0);
    const totalC = tx.ledger_entries.reduce((s, e) => s + Number(e.credit_amount), 0);
    if (Math.abs(totalD - totalC) > 0.01) {
      console.error(`  ❌ Ledger TX#${tx.id}: D=${totalD} ≠ C=${totalC}`);
      ledgerValid = false;
    }
  }
  if (ledgerValid) console.log(`  ✅ Sổ kép cân bằng (${txs.length} transactions)`);
}
