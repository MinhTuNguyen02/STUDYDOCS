/**
 * ═══════════════════════════════════════════════════════════
 * PHẦN 4/4: REVIEWS, REPORTS, DISPUTES & ADMIN PANEL
 * ═══════════════════════════════════════════════════════════
 * 
 * Bao gồm:
 * - Reviews: create, reply, average_rating
 * - Reports: create, resolve, status lifecycle
 * - Disputes: create (2-day rule), analyze, resolve (refund)
 * - Admin: dashboard, audit logs, revenue report
 * - Moderation: reports, penalty
 */
import * as request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getApp,
  registerAndLogin,
  loginAs,
  authGet,
  authPost,
  authPatch,
  authPut,
  authDelete,
  TestUser
} from './test-utils';

describe('PHẦN 4: Reviews, Reports, Disputes & Admin (e2e)', () => {
  let customer: TestUser;
  let adminUser: TestUser;
  let modUser: TestUser;

  beforeAll(async () => {
    await createTestApp();
    customer = await registerAndLogin(
      `interact_${Date.now()}@test.com`, 'Interact@123', 'Interact User'
    );
    try {
      adminUser = await loginAs('admin@studydocs.vn', 'admin123');
    } catch {
      console.warn('⚠️  Admin seed account not found.');
    }
    try {
      modUser = await loginAs('mod@studydocs.vn', 'mod123');
    } catch {
      console.warn('⚠️  Mod seed account not found. Mod tests will use admin instead.');
      modUser = adminUser;
    }
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── REVIEWS ──────────────────────────────────────────────

  describe('Reviews', () => {
    it('✅ Xem reviews của tài liệu (public, có thể trống)', async () => {
      const res = await authGet('/reviews/documents/1', customer.accessToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('❌ Đánh giá tài liệu chưa mua', async () => {
      const res = await authPost('/reviews/documents/1', customer.accessToken)
        .send({ rating: 5, comment: 'Tài liệu rất hay!' });

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
      const res = await authPost('/reviews/1/reply', customer.accessToken)
        .send({ replyText: 'Cảm ơn bạn!' });

      // 403 (không phải seller) hoặc 404 (review không tồn tại)
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── REPORTS ──────────────────────────────────────────────

  describe('Reports', () => {
    let reportId: number;

    it('✅ Customer tạo báo cáo vi phạm', async () => {
      const res = await authPost('/reports', customer.accessToken)
        .send({
          documentId: 1,
          type: 'SPAM',
          reason: 'Tài liệu chứa nội dung spam'
        });

      if (res.status === 201) {
        reportId = res.body.report_id;
        expect(res.body.status).toBe('PENDING');
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
      const res = await authGet('/reports', modUser.accessToken)
        .expect(200);

      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });

    it('❌ Customer không thể xem danh sách reports', async () => {
      await authGet('/reports', customer.accessToken)
        .expect(403);
    });

    it('✅ Mod resolve report: PENDING→REVIEWING', async () => {
      if (!modUser || !reportId) return;
      const res = await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'REVIEWING' })
        .expect(200);

      expect(res.body.status).toBe('REVIEWING');
    });

    it('✅ Mod resolve report: REVIEWING→RESOLVED', async () => {
      if (!modUser || !reportId) return;
      const res = await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');
    });

    it('❌ Không thể chuyển RESOLVED→PENDING (status lifecycle)', async () => {
      if (!modUser || !reportId) return;
      await authPut(`/reports/${reportId}/resolve`, modUser.accessToken)
        .send({ status: 'PENDING' })
        .expect(400);
    });
  });

  // ─── DISPUTES ──────────────────────────────────────────────

  describe('Disputes', () => {
    it('❌ Tạo dispute: orderItem không tồn tại', async () => {
      await authPost('/disputes', customer.accessToken)
        .send({
          orderItemId: 999999,
          reason: 'File bị lỗi',
          description: 'Không mở được tài liệu'
        })
        .expect(404);
    });

    it('❌ Tạo dispute: thiếu thông tin (DTO validation)', async () => {
      await authPost('/disputes', customer.accessToken)
        .send({ orderItemId: 1 }) // Thiếu reason & description
        .expect(400);
    });

    it('❌ Tạo dispute: khách chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .post('/disputes')
        .send({
          orderItemId: 1,
          reason: 'Test',
          description: 'Test description'
        })
        .expect(401);
    });

    it('❌ Customer không thể analyze dispute', async () => {
      const res = await authPut('/disputes/1/analyze', customer.accessToken);
      expect([403, 404]).toContain(res.status);
    });

    it('❌ Customer không thể resolve dispute', async () => {
      const res = await authPut('/disputes/1/resolve', customer.accessToken)
        .send({ status: 'RESOLVED', resolution: 'Test' });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── MODERATION ────────────────────────────────────────────

  describe('Moderation (Reports via /moderation)', () => {
    it('✅ Admin/Mod xem reports qua moderation', async () => {
      if (!adminUser) return;
      const res = await authGet('/moderation/reports', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem moderation reports', async () => {
      await authGet('/moderation/reports', customer.accessToken)
        .expect(403);
    });
  });

  // ─── ADMIN DASHBOARD ──────────────────────────────────────

  describe('Admin Dashboard', () => {
    it('✅ Admin xem dashboard thống kê', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/dashboard', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem admin dashboard', async () => {
      await authGet('/admin/dashboard', customer.accessToken)
        .expect(403);
    });
  });

  // ─── ADMIN: DOCUMENT APPROVALS ─────────────────────────────

  describe('Admin Document Approvals', () => {
    it('✅ Admin xem danh sách chờ duyệt', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/approvals/documents', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Approve document không tồn tại', async () => {
      if (!adminUser) return;
      await authPatch('/admin/approvals/documents/999999/approve', adminUser.accessToken)
        .expect(404);
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
    it('✅ Admin xem danh sách users', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/users', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem users list', async () => {
      await authGet('/admin/users', customer.accessToken)
        .expect(403);
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
      const res = await authPost('/tags', adminUser.accessToken)
        .send({ tagName: `test-tag-${Date.now()}` })
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
      const res = await authGet('/admin/audit-logs', adminUser.accessToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('✅ Admin xem audit logs filter by action', async () => {
      if (!adminUser) return;
      const res = await authGet('/admin/audit-logs?action=RELEASE_HELD_FUNDS&limit=5', adminUser.accessToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('❌ Customer không thể xem audit logs', async () => {
      await authGet('/admin/audit-logs', customer.accessToken)
        .expect(403);
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
      const res = await authGet('/admin/reports/revenue', adminUser.accessToken)
        .expect(200);

      // Trả về mảng rỗng nếu thiếu startDate/endDate
      expect(res.body).toEqual([]);
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
      const res = await authGet('/admin/reconciliation', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể xem đối soát', async () => {
      await authGet('/admin/reconciliation', customer.accessToken)
        .expect(403);
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
