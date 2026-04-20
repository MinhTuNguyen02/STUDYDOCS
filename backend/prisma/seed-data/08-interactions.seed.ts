import { PrismaClient } from '@prisma/client';

/**
 * Phase 8: Download History + Reviews + Wishlists
 * download_history COUNT phải khớp document.download_count
 */
export async function seedInteractions(prisma: PrismaClient) {
  console.log('\n💬 Phase 8: Interactions (downloads, reviews, wishlists)...');

  // ── Helpers ──
  async function getCustId(email: string) {
    const acc = await prisma.accounts.findUnique({ where: { email }, include: { customer_profiles: true } });
    return acc!.customer_profiles!.customer_id;
  }
  async function getDocId(slug: string) {
    const doc = await prisma.documents.findUnique({ where: { slug } });
    return doc!.document_id;
  }

  const buyer1 = await getCustId('buyer1@gmail.com');
  const buyer2 = await getCustId('buyer2@gmail.com');

  const doc1 = await getDocId('giao-trinh-python-co-ban');
  const doc2 = await getDocId('de-thi-csdl-hk1-2025');
  const doc3 = await getDocId('tong-hop-ngu-phap-toeic');
  const doc4 = await getDocId('giao-trinh-luat-dan-su-vn');
  const doc5 = await getDocId('atlas-giai-phau-y-khoa');
  const doc6 = await getDocId('bai-tap-ctdl-giai-thuat');
  const doc9 = await getDocId('slide-marketing-can-ban');

  // Lấy order_item IDs (theo thứ tự tạo)
  const orderItems = await prisma.order_items.findMany({
    orderBy: { created_at: 'asc' },
    take: 7,
  });

  // ── Download History (8 records) ──
  const existingDL = await prisma.download_history.count();
  if (existingDL === 0) {
    // Map: oi index → order_item_id
    const oi = (idx: number) => orderItems[idx]?.order_item_id ?? null;

    await prisma.download_history.createMany({
      data: [
        { customer_id: buyer1, document_id: doc1, order_item_id: oi(0), download_type: 'PURCHASED', ip_address: '192.168.1.10' },
        { customer_id: buyer1, document_id: doc2, order_item_id: oi(1), download_type: 'PURCHASED', ip_address: '192.168.1.10' },
        { customer_id: buyer1, document_id: doc4, order_item_id: oi(2), download_type: 'PURCHASED', ip_address: '192.168.1.10' },
        { customer_id: buyer2, document_id: doc3, order_item_id: oi(3), download_type: 'PURCHASED', ip_address: '192.168.1.20' },
        { customer_id: buyer2, document_id: doc5, order_item_id: oi(4), download_type: 'PURCHASED', ip_address: '192.168.1.20' },
        { customer_id: buyer2, document_id: doc1, order_item_id: oi(5), download_type: 'PURCHASED', ip_address: '192.168.1.20' },
        { customer_id: buyer1, document_id: doc9, order_item_id: oi(6), download_type: 'PURCHASED', ip_address: '192.168.1.10' },
        { customer_id: buyer1, document_id: doc6, order_item_id: null, download_type: 'FREE_MONTHLY', ip_address: '192.168.1.10' },
      ],
    });
    console.log('  ✅ Download History (8) — matches document.download_count');
  }

  // ── Reviews (4 records) — chỉ buyer đã mua mới review được ──
  const existingRV = await prisma.reviews.count();
  if (existingRV === 0 && orderItems.length >= 4) {
    const reviews = [
      { oiIdx: 0, docId: doc1, buyerId: buyer1, rating: 5, comment: 'Tài liệu rất chi tiết, dễ hiểu cho người mới bắt đầu.' },
      { oiIdx: 1, docId: doc2, buyerId: buyer1, rating: 4, comment: 'Đề thi sát thực tế, đáp án rõ ràng.' },
      { oiIdx: 2, docId: doc4, buyerId: buyer1, rating: 3, comment: 'Nội dung hơi cũ, cần cập nhật thêm.' },
      { oiIdx: 3, docId: doc3, buyerId: buyer2, rating: 5, comment: 'TOEIC cực kỳ hữu ích, đã tăng 100 điểm!' },
    ];

    for (const r of reviews) {
      await prisma.reviews.create({
        data: {
          order_item_id: orderItems[r.oiIdx].order_item_id,
          document_id: r.docId,
          buyer_id: r.buyerId,
          rating: r.rating,
          comment: r.comment,
        },
      });
    }

    // Cập nhật average_rating trên documents
    for (const docId of [doc1, doc2, doc3, doc4]) {
      const agg = await prisma.reviews.aggregate({
        where: { document_id: docId, is_deleted: { not: true } },
        _avg: { rating: true },
      });
      if (agg._avg.rating) {
        await prisma.documents.update({
          where: { document_id: docId },
          data: { average_rating: parseFloat(agg._avg.rating.toFixed(2)) },
        });
      }
    }
    console.log('  ✅ Reviews (4) + average_rating updated');
  }

  // ── Wishlists ──
  const existingWL = await prisma.wishlists.count();
  if (existingWL === 0) {
    await prisma.wishlists.createMany({
      data: [
        { customer_id: buyer1, document_id: doc5 },
        { customer_id: buyer1, document_id: doc9 },
        { customer_id: buyer2, document_id: doc2 },
      ],
      skipDuplicates: true,
    });
    console.log('  ✅ Wishlists (3)');
  }
}
