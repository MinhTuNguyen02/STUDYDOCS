import { PrismaClient } from '@prisma/client';

/**
 * Phase 4: Categories bổ sung + Tags
 * Categories 8-28 đã có sẵn, thêm 29-32.
 */
export async function seedCatalog(prisma: PrismaClient) {
  console.log('\n📂 Phase 4: Catalog (categories + tags)...');

  // ── Categories bổ sung (parent_id = 9 Kinh tế, 11 Khoa học) ──
  const extraCategories = [
    { name: 'Marketing', parent_id: 9, slug: 'marketing' },
    { name: 'Kế toán tài chính', parent_id: 9, slug: 'ke-toan-tai-chinh' },
    { name: 'Vật lý', parent_id: 11, slug: 'vat-ly' },
    { name: 'Hóa học', parent_id: 11, slug: 'hoa-hoc' },
  ];

  for (const c of extraCategories) {
    const existing = await prisma.categories.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      await prisma.categories.create({ data: c });
    }
  }
  console.log('  ✅ Categories bổ sung (4)');

  // ── Tags ──
  const tags = [
    { tag_name: 'Đề thi', slug: 'de-thi' },
    { tag_name: 'Giáo trình', slug: 'giao-trinh' },
    { tag_name: 'Tóm tắt', slug: 'tom-tat' },
    { tag_name: 'Bài tập', slug: 'bai-tap' },
    { tag_name: 'Slide', slug: 'slide' },
    { tag_name: 'Đồ án', slug: 'do-an' },
    { tag_name: 'Luận văn', slug: 'luan-van' },
    { tag_name: 'Ôn tập', slug: 'on-tap' },
    { tag_name: 'Tiểu luận', slug: 'tieu-luan' },
    { tag_name: 'Thực hành', slug: 'thuc-hanh' },
  ];

  for (const t of tags) {
    const existing = await prisma.tags.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      await prisma.tags.create({ data: t });
    }
  }
  console.log('  ✅ Tags (10)');
}
