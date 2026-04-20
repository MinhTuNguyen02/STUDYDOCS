import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

/**
 * Phase 5: Documents + Document Tags
 * download_count phải khớp chính xác với download_history (Phase 10)
 */
export async function seedDocuments(prisma: PrismaClient) {
  console.log('\n📄 Phase 5: Documents...');

  // Lấy seller IDs
  const seller1Acc = await prisma.accounts.findUnique({ where: { email: 'seller1@gmail.com' }, include: { customer_profiles: true } });
  const seller2Acc = await prisma.accounts.findUnique({ where: { email: 'seller2@gmail.com' }, include: { customer_profiles: true } });
  if (!seller1Acc?.customer_profiles || !seller2Acc?.customer_profiles) {
    throw new Error('Seller accounts chưa có. Chạy Phase 2 trước.');
  }

  const s1 = seller1Acc.customer_profiles.customer_id;
  const s2 = seller2Acc.customer_profiles.customer_id;

  // Lấy category IDs theo slug
  async function catId(slug: string): Promise<number> {
    const cat = await prisma.categories.findUnique({ where: { slug } });
    if (!cat) throw new Error(`Category "${slug}" not found`);
    return cat.category_id;
  }

  // Lấy mod staff_id để gán cho approved docs
  const modAcc = await prisma.accounts.findUnique({ where: { email: 'mod@studydocs.vn' }, include: { staff_profiles: true } });
  const modStaffId = modAcc?.staff_profiles?.staff_id ?? null;

  const now = new Date('2026-04-05T10:00:00+07:00');

  const docs = [
    {
      seller_id: s1, category_slug: 'lap-trinh-python', title: 'Giáo trình Python cơ bản',
      slug: 'giao-trinh-python-co-ban', description: 'Giáo trình Python từ cơ bản đến nâng cao, phù hợp sinh viên CNTT năm nhất.',
      price: 25000, page_count: 45, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 320, download_count: 2, tag_slug: 'giao-trinh',
      published_at: new Date('2026-04-06T08:00:00+07:00'),
    },
    {
      seller_id: s1, category_slug: 'co-so-du-lieu', title: 'Đề thi CSDL HK1 2025',
      slug: 'de-thi-csdl-hk1-2025', description: 'Tổng hợp đề thi Cơ sở dữ liệu HK1 năm 2025 có đáp án chi tiết.',
      price: 15000, page_count: 12, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 185, download_count: 1, tag_slug: 'de-thi',
      published_at: new Date('2026-04-06T08:00:00+07:00'),
    },
    {
      seller_id: s1, category_slug: 'tieng-anh', title: 'Tổng hợp ngữ pháp TOEIC',
      slug: 'tong-hop-ngu-phap-toeic', description: 'Tài liệu tổng hợp ngữ pháp TOEIC Part 5, 6 với 500+ câu luyện tập.',
      price: 30000, page_count: 60, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 540, download_count: 1, tag_slug: 'tom-tat',
      published_at: new Date('2026-04-07T08:00:00+07:00'),
    },
    {
      seller_id: s2, category_slug: 'luat-dan-su', title: 'Giáo trình Luật dân sự Việt Nam',
      slug: 'giao-trinh-luat-dan-su-vn', description: 'Giáo trình Luật dân sự Việt Nam, cập nhật theo Bộ luật 2015.',
      price: 20000, page_count: 35, status: 'APPROVED' as const, file_extension: 'docx',
      view_count: 210, download_count: 1, tag_slug: 'giao-trinh',
      published_at: new Date('2026-04-06T09:00:00+07:00'),
    },
    {
      seller_id: s2, category_slug: 'y-khoa-co-so', title: 'Atlas giải phẫu Y khoa cơ sở',
      slug: 'atlas-giai-phau-y-khoa', description: 'Atlas giải phẫu Y khoa cơ sở với hình ảnh minh họa chi tiết.',
      price: 35000, page_count: 80, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 415, download_count: 1, tag_slug: 'giao-trinh',
      published_at: new Date('2026-04-07T09:00:00+07:00'),
    },
    {
      seller_id: s1, category_slug: 'cau-truc-du-lieu-giai-thuat', title: 'Bài tập CTDL & Giải thuật',
      slug: 'bai-tap-ctdl-giai-thuat', description: 'Tổng hợp bài tập CTDL cơ bản: Stack, Queue, LinkedList, Tree.',
      price: 0, page_count: 8, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 95, download_count: 1, tag_slug: 'bai-tap',
      published_at: new Date('2026-04-08T08:00:00+07:00'),
    },
    {
      seller_id: s2, category_slug: 'tieng-nhat', title: 'Kanji N4 tổng hợp',
      slug: 'kanji-n4-tong-hop', description: 'Tổng hợp 300 Kanji N4 với cách đọc và ví dụ.',
      price: 18000, page_count: 25, status: 'PENDING' as const, file_extension: 'pdf',
      view_count: 0, download_count: 0, tag_slug: null,
      published_at: null,
    },
    {
      seller_id: s1, category_slug: 'lap-trinh-cpp', title: 'Lập trình C++ nâng cao',
      slug: 'lap-trinh-cpp-nang-cao', description: 'Tài liệu C++ nâng cao: Template, STL, OOP.',
      price: 22000, page_count: 30, status: 'REJECTED' as const, file_extension: 'docx',
      view_count: 0, download_count: 0, tag_slug: 'giao-trinh',
      published_at: null,
    },
    {
      seller_id: s2, category_slug: 'marketing', title: 'Slide Marketing căn bản',
      slug: 'slide-marketing-can-ban', description: 'Bộ slide Marketing căn bản cho sinh viên Kinh tế.',
      price: 12000, page_count: 15, status: 'APPROVED' as const, file_extension: 'pptx',
      view_count: 130, download_count: 1, tag_slug: 'slide',
      published_at: new Date('2026-04-09T08:00:00+07:00'),
    },
    {
      seller_id: s1, category_slug: 'vat-ly', title: 'Công thức Vật lý đại cương',
      slug: 'cong-thuc-vat-ly-dai-cuong', description: 'Tóm tắt công thức Vật lý đại cương 1 & 2.',
      price: 0, page_count: 5, status: 'APPROVED' as const, file_extension: 'pdf',
      view_count: 60, download_count: 0, tag_slug: 'tom-tat',
      published_at: new Date('2026-04-10T08:00:00+07:00'),
    },
  ];

  const createdDocIds: number[] = [];

  for (const doc of docs) {
    const existing = await prisma.documents.findUnique({ where: { slug: doc.slug } });
    if (existing) {
      createdDocIds.push(existing.document_id);
      continue;
    }

    const categoryId = await catId(doc.category_slug);
    const fileHash = createHash('sha256').update(`${doc.slug}:seed`).digest('hex');

    const created = await prisma.documents.create({
      data: {
        seller_id: doc.seller_id,
        category_id: categoryId,
        title: doc.title,
        slug: doc.slug,
        description: doc.description,
        price: doc.price,
        page_count: doc.page_count,
        status: doc.status,
        rejection_reason: doc.status === 'REJECTED' ? 'Nội dung trùng lặp với tài liệu đã có trên hệ thống.' : null,
        file_url: `docs/${doc.slug}.${doc.file_extension}`,
        preview_url: `preview/${doc.slug}`,
        file_size: doc.page_count * 50000,
        file_extension: doc.file_extension,
        file_hash: fileHash,
        view_count: doc.view_count,
        download_count: doc.download_count,
        average_rating: 0,
        staff_id: doc.status !== 'PENDING' ? modStaffId : null,
        published_at: doc.published_at,
        created_at: now,
      },
    });
    createdDocIds.push(created.document_id);
  }
  console.log(`  ✅ Documents (10) — IDs: [${createdDocIds.join(', ')}]`);

  // ── Document Tags ──
  const tagMap: Record<string, number | undefined> = {};
  const allTags = await prisma.tags.findMany();
  for (const t of allTags) tagMap[t.slug] = t.tag_id;

  for (let i = 0; i < docs.length; i++) {
    if (!docs[i].tag_slug) continue;
    const tagId = tagMap[docs[i].tag_slug!];
    if (!tagId) continue;
    const docId = createdDocIds[i];

    const existing = await prisma.document_tags.findUnique({
      where: { document_id_tag_id: { document_id: docId, tag_id: tagId } },
    });
    if (!existing) {
      await prisma.document_tags.create({
        data: { document_id: docId, tag_id: tagId },
      });
    }
  }
  console.log('  ✅ Document Tags');
}
