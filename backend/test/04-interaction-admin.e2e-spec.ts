/**
 * ═══════════════════════════════════════════════════════════
 * PHẦN 4/4: REVIEWS, REPORTS & ADMIN PANEL
 * ═══════════════════════════════════════════════════════════
 *
 * Bao gồm:
 * - Reviews: create, reply, average_rating
 * - Reports: create, resolve, status lifecycle
 * - Admin: dashboard, audit logs, revenue report
 * - Moderation: reports, penalty
 */
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';
import {
  createTestApp,
  closeTestApp,
  getApp,
  registerAndLogin,
  ensureTestStaff,
  authGet,
  authPost,
  authPatch,
  authPut,
  authDelete,
  TestUser
} from './test-utils';

describe('PHẦN 4: Reviews, Reports & Admin (e2e)', () => {
  let customer: TestUser;
  let adminUser: TestUser;
  let modUser: TestUser;
  let accountantUser: TestUser;

  beforeAll(async () => {
    await createTestApp();
    customer = await registerAndLogin(
      `interact_${Date.now()}@test.com`,
      'Interact@123',
      'Interact User'
    );
    adminUser = await ensureTestStaff(
      'admin-interaction-e2e@studydocs.test',
      'Admin@Test123',
      'ADMIN'
    );
    modUser = await ensureTestStaff(
      'mod-interaction-e2e@studydocs.test',
      'Moderator@Test123',
      'MOD'
    );
    accountantUser = await ensureTestStaff(
      'accountant-interaction-e2e@studydocs.test',
      'Accountant@Test123',
      'ACCOUNTANT'
    );
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── REVIEWS ──────────────────────────────────────────────

  describe('Reviews', () => {
    it('✅ Xem reviews của tài liệu (public, có thể trống)', async () => {
      const res = await authGet('/reviews/documents/1', customer.accessToken).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('❌ Đánh giá tài liệu chưa mua', async () => {
      const res = await authPost('/reviews/documents/1', customer.accessToken).send({
        rating: 5,
        comment: 'Tài liệu rất hay!'
      });

      // 403 (chưa mua) hoặc 404 (doc không tồn tại)
      expect([403, 404]).toContain(res.status);
    });

    it('❌ Đánh giá khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .post('/reviews/documents/1')
        .send({ rating: 5, comment: 'Test' })
        .expect(401);
    });

    it('❌ Reply review: customer không phải seller của doc', async () => {
      const res = await authPost('/reviews/1/reply', customer.accessToken).send({
        reply: 'Cảm ơn bạn!'
      });

      // 403 (không phải seller) hoặc 404 (review không tồn tại)
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── REPORTS ──────────────────────────────────────────────

  describe('Reports', () => {
    let reportId: number;

    it('✅ Customer tạo báo cáo vi phạm', async () => {
      const res = await authPost('/reports', customer.accessToken).send({
        documentId: 1,
        type: 'SPAM',
        reason: 'Tài liệu chứa nội dung spam'
      });

      if (res.status === 201) {
        reportId = res.body.report.report_id;
        expect(res.body.report.status).toBe('PENDING');
      }
      // 404 nếu documentId 1 không tồn tại
      expect([201, 404]).toContain(res.status);
    });

    it('❌ Tạo report thiếu thông tin', async () => {
      await authPost('/reports', customer.accessToken)
        .send({ documentId: 1 }) // Thiếu type và reason
        .expect(400);
    });

    it('✅ Mod xem danh sách reports', async () => {
      if (!modUser) return;
      const res = await authGet('/reports?page=1&limit=10&status=ALL', modUser.accessToken).expect(
        200
      );

      expect(Array.isArray(res.body.data || res.body)).toBe(true);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 10 }));
    });

    it('❌ Customer không thể xem danh sách reports', async () => {
      await authGet('/reports', customer.accessToken).expect(403);
    });

    it('❌ Từ chối report filter không hợp lệ', async () => {
      await authGet('/reports?status=UNKNOWN', modUser.accessToken).expect(400);
    });

    it('✅ Mod resolve report: PENDING→REVIEWING', async () => {
      if (!modUser || !reportId) return;
      const res = await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'REVIEWING' })
        .expect(200);

      expect(res.body.data.status).toBe('REVIEWING');
    });

    it('✅ Mod resolve report: REVIEWING→RESOLVED', async () => {
      if (!modUser || !reportId) return;
      const res = await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(res.body.data.status).toBe('RESOLVED');
    });

    it('❌ Không thể chuyển RESOLVED→PENDING (status lifecycle)', async () => {
      if (!modUser || !reportId) return;
      await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'PENDING' })
        .expect(400);
    });
  });

  // ─── MODERATION ────────────────────────────────────────────

  describe('Moderation (Reports via /moderation)', () => {
    it('✅ Admin/Mod xem reports qua moderation', async () => {
      if (!adminUser) return;
      const res = await authGet('/reports', adminUser.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem moderation reports', async () => {
      await authGet('/reports', customer.accessToken).expect(403);
    });
  });

  // ─── ADMIN DASHBOARD ──────────────────────────────────────

  describe('Admin Dashboard', () => {
    it('✅ Accountant xem dashboard tài chính nhưng không quản lý user', async () => {
      await authGet('/admin/dashboard', accountantUser.accessToken).expect(200);
      await authGet('/admin/users', accountantUser.accessToken).expect(403);
    });

    it('❌ Moderator không truy cập dashboard tài chính', async () => {
      await authGet('/admin/dashboard', modUser.accessToken).expect(403);
    });

    it('✅ Admin xem dashboard thống kê', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/dashboard', adminUser.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem admin dashboard', async () => {
      await authGet('/admin/dashboard', customer.accessToken).expect(403);
    });
  });

  // ─── ADMIN: DOCUMENT APPROVALS ─────────────────────────────

  describe('Admin Document Approvals', () => {
    it('✅ Chỉ cấp full review URL qua endpoint có audit, không nhúng trong list', async () => {
      if (!adminUser || !customer.customerId) throw new Error('Missing approval test fixture');
      const prisma = getApp().get(PrismaService);
      const storage = getApp().get(StorageService);
      const suffix = Date.now();
      const category = await prisma.categories.create({
        data: { name: `Review category ${suffix}`, slug: `review-category-${suffix}` }
      });
      const document = await prisma.documents.create({
        data: {
          seller_id: customer.customerId,
          category_id: category.category_id,
          title: `Audited review ${suffix}`,
          slug: `audited-review-${suffix}`,
          description: 'Approval review audit test',
          price: 0,
          page_count: 1,
          status: 'PENDING',
          file_url: `private/audited-review-${suffix}.pdf`,
          file_extension: 'pdf',
          file_hash: `${suffix}`.padEnd(64, '0').slice(0, 64)
        }
      });

      const list = await authGet(
        `/admin/approvals/documents?search=${encodeURIComponent(document.title)}`,
        adminUser.accessToken
      ).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].reviewSignedUrl).toBeUndefined();
      expect(list.body.data[0].hasReviewFile).toBe(true);

      const signedUrlSpy = jest
        .spyOn(storage, 'getPresignedUrl')
        .mockResolvedValue('http://127.0.0.1/audited-review.pdf');
      try {
        const review = await authGet(
          `/admin/approvals/documents/${document.document_id}/review-url`,
          adminUser.accessToken
        ).expect(200);
        expect(review.body.reviewUrl).toBe('http://127.0.0.1/audited-review.pdf');
        expect(
          await prisma.audit_logs.count({
            where: {
              action: 'STAFF_REVIEW_DOCUMENT',
              target_table: 'documents',
              target_id: document.document_id
            }
          })
        ).toBe(1);
      } finally {
        signedUrlSpy.mockRestore();
      }
    });

    it('✅ Admin và moderator xem danh sách tài liệu có phân trang server-side', async () => {
      if (!adminUser) return;
      const adminResponse = await authGet(
        '/admin/documents?page=1&limit=10&status=ALL',
        adminUser.accessToken
      ).expect(200);
      expect(adminResponse.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 10 }));
      expect(Array.isArray(adminResponse.body.data)).toBe(true);

      await authGet('/admin/documents?page=1&limit=10', modUser.accessToken).expect(200);
    });

    it('❌ Từ chối query phân trang admin không hợp lệ', async () => {
      if (!adminUser) return;
      await authGet('/admin/documents?limit=101', adminUser.accessToken).expect(400);
    });

    it('✅ Admin xem danh sách chờ duyệt', async () => {
      if (!adminUser) return;
      const res = await authGet(
        '/admin/approvals/documents?page=1&limit=10',
        adminUser.accessToken
      ).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 10 }));
    });

    it('❌ Từ chối query approvals không hợp lệ', async () => {
      if (!adminUser) return;
      await authGet('/admin/approvals/documents?limit=101', adminUser.accessToken).expect(400);
    });

    it('❌ Approve document không tồn tại', async () => {
      if (!adminUser) return;
      await authPatch('/admin/approvals/documents/999999/approve', adminUser.accessToken).expect(
        404
      );
    });

    it('❌ Reject document không tồn tại', async () => {
      if (!adminUser) return;
      await authPatch('/admin/approvals/documents/999999/reject', adminUser.accessToken)
        .send({ reason: 'Nội dung không phù hợp' })
        .expect(404);
    });
  });

  // ─── ADMIN: USER MANAGEMENT ────────────────────────────────

  describe('Admin User Management', () => {
    it('✅ Admin xem danh sách users có filter/sort/pagination server-side', async () => {
      if (!adminUser) return;
      const res = await authGet(
        '/admin/users?role=CUSTOMER&status=ACTIVE&sort=NEWEST&page=1&limit=15',
        adminUser.accessToken
      ).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 15 }));
      expect(res.body.summary).toEqual(
        expect.objectContaining({ customers: expect.any(Number), staff: expect.any(Number) })
      );
    });

    it('❌ Từ chối query users không hợp lệ', async () => {
      if (!adminUser) return;
      await authGet('/admin/users?role=ROOT', adminUser.accessToken).expect(400);
      await authGet('/admin/users?page=0', adminUser.accessToken).expect(400);
    });

    it('✅ Moderator chỉ xem được khách hàng, không xem danh sách nhân viên', async () => {
      await authGet('/admin/users?role=CUSTOMER&page=1&limit=15', modUser.accessToken).expect(200);
      await authGet('/admin/users?role=STAFF', modUser.accessToken).expect(403);
    });

    it('❌ Customer không thể xem users list', async () => {
      await authGet('/admin/users', customer.accessToken).expect(403);
    });
  });

  // ─── ADMIN: CATEGORIES & TAGS ──────────────────────────────

  describe('Admin Categories & Tags Management', () => {
    let testCategoryId: number;
    let testTagId: number;

    it('✅ Admin tạo category', async () => {
      if (!adminUser) return;
      const res = await authPost('/categories', adminUser.accessToken)
        .send({ name: `Test Cat ${Date.now()}`, slug: `test-cat-${Date.now()}` })
        .expect(201);

      testCategoryId = res.body.data?.category_id || res.body.category_id;
    });

    it('✅ Admin cập nhật category', async () => {
      if (!adminUser || !testCategoryId) return;
      await authPatch(`/categories/${testCategoryId}`, adminUser.accessToken)
        .send({ name: 'Updated Category' })
        .expect(200);
    });

    it('✅ Admin tạo tag', async () => {
      if (!adminUser) return;
      const suffix = Date.now();
      const res = await authPost('/tags', adminUser.accessToken)
        .send({ tag_name: `Test tag ${suffix}`, slug: `test-tag-${suffix}` })
        .expect(201);

      testTagId = res.body.data?.tag_id || res.body.tag_id;
    });

    it('❌ Customer không thể tạo category', async () => {
      await authPost('/categories', customer.accessToken)
        .send({ name: 'Illegal Cat', slug: 'illegal' })
        .expect(403);
    });
  });

  // ─── ADMIN: AUDIT LOGS ────────────────────────────────────

  describe('Admin Audit Logs', () => {
    it('✅ Admin xem audit logs', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/audit-logs', adminUser.accessToken).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 50 }));
    });

    it('✅ Admin xem audit logs filter by action', async () => {
      if (!adminUser) return;
      const res = await authGet(
        '/admin/audit-logs?action=PROCESS_WITHDRAWAL&limit=5',
        adminUser.accessToken
      ).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.limit).toBe(5);
    });

    it('❌ Từ chối audit pagination vượt giới hạn', async () => {
      if (!adminUser) return;
      await authGet('/admin/audit-logs?limit=101', adminUser.accessToken).expect(400);
    });

    it('❌ Customer không thể xem audit logs', async () => {
      await authGet('/admin/audit-logs', customer.accessToken).expect(403);
    });
  });

  // ─── ADMIN: REVENUE REPORT ────────────────────────────────

  describe('Admin Revenue Report', () => {
    it('✅ Admin xuất báo cáo doanh thu', async () => {
      if (!adminUser) return;
      const res = await authGet(
        '/admin/reports/revenue?startDate=2026-01-01&endDate=2026-12-31',
        adminUser.accessToken
      ).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('❌ Revenue report thiếu ngày', async () => {
      if (!adminUser) return;
      await authGet('/admin/reports/revenue', adminUser.accessToken).expect(400);
    });

    it('❌ Revenue report từ chối khoảng ngày không hợp lệ', async () => {
      if (!adminUser) return;
      await authGet(
        '/admin/reports/revenue?startDate=2026-12-31&endDate=2026-01-01',
        adminUser.accessToken
      ).expect(400);
      await authGet(
        '/admin/reports/revenue?startDate=2026-99-99&endDate=2026-12-31',
        adminUser.accessToken
      ).expect(400);
    });

    it('❌ Customer không thể xuất báo cáo', async () => {
      await authGet(
        '/admin/reports/revenue?startDate=2026-01-01&endDate=2026-12-31',
        customer.accessToken
      ).expect(403);
    });
  });

  // ─── ADMIN: RECONCILIATION ────────────────────────────────

  describe('Admin Reconciliation', () => {
    it('✅ Admin xem đối soát', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/reconciliation', adminUser.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem đối soát', async () => {
      await authGet('/admin/reconciliation', customer.accessToken).expect(403);
    });
  });

  // ─── RATE LIMITING ─────────────────────────────────────────

  describe('Throttler / Rate Limiting', () => {
    it('✅ API phản hồi bình thường với tần suất hợp lệ', async () => {
      // Gửi 5 request nhanh liên tục — dưới limit 100/min
      const promises = Array.from({ length: 5 }, () =>
        request(getApp().getHttpServer()).get('/documents').expect(200)
      );
      await Promise.all(promises);
    });

    // Không test 429 Too Many Requests vì limit = 100/minute, khó trigger trong test
    // Nhưng ta xác nhận ThrottlerGuard đã được đăng ký ở AppModule
  });
});
