import { PrismaClient } from '@prisma/client';

/**
 * Phase 9: Reports + Disputes + Audit Logs
 */
export async function seedModeration(prisma: PrismaClient) {
  console.log('\n🛡️ Phase 9: Moderation (reports, disputes, audit_logs)...');

  async function getCustId(email: string) {
    const acc = await prisma.accounts.findUnique({ where: { email }, include: { customer_profiles: true } });
    return acc!.customer_profiles!.customer_id;
  }
  async function getAccId(email: string) {
    const acc = await prisma.accounts.findUnique({ where: { email } });
    return acc!.account_id;
  }
  async function getStaffId(email: string) {
    const acc = await prisma.accounts.findUnique({ where: { email }, include: { staff_profiles: true } });
    return acc!.staff_profiles!.staff_id;
  }
  async function getDocId(slug: string) {
    const doc = await prisma.documents.findUnique({ where: { slug } });
    return doc!.document_id;
  }

  const buyer2 = await getCustId('buyer2@gmail.com');
  const modAccId = await getAccId('mod@studydocs.vn');
  const modStaffId = await getStaffId('mod@studydocs.vn');
  const doc4 = await getDocId('giao-trinh-luat-dan-su-vn');

  // ── Reports ──
  const existingRP = await prisma.reports.count();
  if (existingRP === 0) {
    await prisma.reports.create({
      data: {
        customer_id: buyer2,
        document_id: doc4,
        type: 'COPYRIGHT',
        reason: 'Tài liệu này sao chép từ sách giáo khoa chính thống mà không ghi nguồn.',
        status: 'PENDING',
      },
    });
    console.log('  ✅ Reports (1)');
  }

  // ── Disputes ──
  const existingDS = await prisma.disputes.count();
  if (existingDS === 0) {
    // Dispute cho order_item #5 (buyer2 mua doc5, HELD)
    const oi5 = await prisma.order_items.findFirst({
      where: {
        orders: { buyer_id: buyer2 },
        documents: { slug: 'atlas-giai-phau-y-khoa' },
        status: 'HELD',
      },
    });

    if (oi5) {
      await prisma.disputes.create({
        data: {
          order_item_id: oi5.order_item_id,
          customer_id: buyer2,
          reason: 'Nội dung không đúng mô tả',
          description: 'Tài liệu quảng cáo là Atlas giải phẫu nhưng thực tế chỉ có phần lý thuyết, không có hình ảnh minh họa như mô tả.',
          status: 'OPEN',
        },
      });
      console.log('  ✅ Disputes (1)');
    }
  }

  // ── Audit Logs ──
  const existingAL = await prisma.audit_logs.count();
  if (existingAL === 0) {
    // Approved docs
    const approvedSlugs = [
      'giao-trinh-python-co-ban', 'de-thi-csdl-hk1-2025', 'tong-hop-ngu-phap-toeic',
      'giao-trinh-luat-dan-su-vn', 'atlas-giai-phau-y-khoa', 'bai-tap-ctdl-giai-thuat',
      'slide-marketing-can-ban', 'cong-thuc-vat-ly-dai-cuong',
    ];
    for (const slug of approvedSlugs) {
      const docId = await getDocId(slug);
      await prisma.audit_logs.create({
        data: {
          account_id: modAccId,
          action: 'APPROVE_DOCUMENT',
          target_table: 'documents',
          target_id: docId,
          old_value: { status: 'PENDING' },
          new_value: { status: 'APPROVED' },
        },
      });
    }

    // Rejected doc
    const rejectedDocId = await getDocId('lap-trinh-cpp-nang-cao');
    await prisma.audit_logs.create({
      data: {
        account_id: modAccId,
        action: 'REJECT_DOCUMENT',
        target_table: 'documents',
        target_id: rejectedDocId,
        old_value: { status: 'PENDING' },
        new_value: { status: 'REJECTED', reason: 'Nội dung trùng lặp với tài liệu đã có trên hệ thống.' },
      },
    });
    console.log('  ✅ Audit Logs (9)');
  }
}
