/**
 * ═══════════════════════════════════════════════════════════
 * PHẦN 3/4: FINANCIAL, PACKAGES & DOWNLOADS
 * ═══════════════════════════════════════════════════════════
 * 
 * Bao gồm:
 * - Wallet query
 * - Withdrawal flow
 * - Ledger history
 * - Packages CRUD + buy
 * - Downloads + Signed URL
 * - Configs (dynamic settings)
 * - Policies CRUD
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

describe('PHẦN 3: Financial, Packages & Downloads (e2e)', () => {
  let customer: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    await createTestApp();
    customer = await registerAndLogin(
      `finance_${Date.now()}@test.com`, 'Finance@123', 'Finance User'
    );
    try {
      adminUser = await loginAs('admin@studydocs.vn', 'admin123');
    } catch {
      console.warn('⚠️  Admin seed account not found.');
    }
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── WALLETS ──────────────────────────────────────────────

  describe('GET /wallets/me', () => {
    it('✅ Xem ví của tôi (PAYMENT + REVENUE)', async () => {
      const res = await authGet('/wallets/me', customer.accessToken)
        .expect(200);

      const wallets = res.body.data;
      expect(wallets).toBeDefined();
      expect(wallets.length).toBeGreaterThanOrEqual(2);

      const types = wallets.map((w: any) => w.wallet_type);
      expect(types).toContain('PAYMENT');
      expect(types).toContain('REVENUE');
    });

    it('❌ Xem ví khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .get('/wallets/me')
        .expect(401);
    });
  });

  // ─── LEDGER HISTORY ────────────────────────────────────────

  describe('GET /wallets/transactions/me', () => {
    it('✅ Xem lịch sử giao dịch (có thể trống)', async () => {
      const res = await authGet('/wallets/transactions/me', customer.accessToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── WITHDRAWALS ──────────────────────────────────────────

  describe('Withdrawal Flow', () => {
    it('❌ Rút tiền thất bại: số dư không đủ', async () => {
      const res = await authPost('/wallets/withdrawals', customer.accessToken)
        .send({ amount: 500000, bankInfo: { bank: 'VCB', account: '123456' } });
      expect([400, 403]).toContain(res.status);
    });

    it('❌ Rút tiền thất bại: dưới mức tối thiểu', async () => {
      const res = await authPost('/wallets/withdrawals', customer.accessToken)
        .send({ amount: 1000, bankInfo: { bank: 'VCB', account: '123456' } });
      expect([400, 403]).toContain(res.status);
    });

    it('✅ Xem danh sách yêu cầu rút tiền (có thể trống)', async () => {
      const res = await authGet('/wallets/withdrawals/me', customer.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ─── WITHDRAWAL PROCESSING (Accountant/Admin) ────────────

  describe('PATCH /wallets/withdrawals/:id', () => {
    it('❌ Customer không thể duyệt withdrawal', async () => {
      await authPatch('/wallets/withdrawals/1', customer.accessToken)
        .send({ status: 'PAID' })
        .expect(403);
    });
  });

  // ─── RELEASE HELD FUNDS (Manual trigger) ──────────────────

  describe('POST /wallets/jobs/release-held-funds', () => {
    it('✅ Trigger release held funds thành công', async () => {
      if (!adminUser) return;
      const res = await authPost('/wallets/jobs/release-held-funds', adminUser.accessToken)
        .expect(201);

      expect(res.body.releasedCount).toBeDefined();
    });

    it('❌ Customer không thể trigger release', async () => {
      await authPost('/wallets/jobs/release-held-funds', customer.accessToken)
        .expect(403);
    });
  });

  // ─── PACKAGES ──────────────────────────────────────────────

  describe('Packages CRUD', () => {
    let packageId: number;

    it('✅ Xem danh sách gói active (public)', async () => {
      const res = await authGet('/packages', customer.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin xem tất cả gói (gồm inactive)', async () => {
      if (!adminUser) return;
      const res = await authGet('/packages/admin/all', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin tạo gói mới', async () => {
      if (!adminUser) return;
      const res = await authPost('/packages', adminUser.accessToken)
        .send({
          name: `Test Package ${Date.now()}`,
          description: 'Gói test tải xuống',
          price: 50000,
          downloadTurns: 10,
          durationDays: 30
        })
        .expect(201);

      expect(res.body.package_id || res.body.data?.package_id).toBeDefined();
      packageId = res.body.package_id || res.body.data?.package_id;
    });

    it('❌ Mua gói thất bại: không đủ tiền', async () => {
      if (!packageId) return;
      await authPost(`/packages/${packageId}/buy`, customer.accessToken)
        .expect(400);
    });

    it('❌ Mua gói thất bại: gói không tồn tại', async () => {
      await authPost('/packages/999999/buy', customer.accessToken)
        .expect(404);
    });

    it('❌ Customer không thể tạo gói', async () => {
      await authPost('/packages', customer.accessToken)
        .send({
          name: 'Illegal Package',
          description: 'Should fail',
          price: 10000,
          downloadTurns: 5,
          durationDays: 30
        })
        .expect(403);
    });
  });

  // ─── DOWNLOADS ─────────────────────────────────────────────

  describe('GET /downloads/:id', () => {
    it('❌ Tải tài liệu chưa mua: bị chặn', async () => {
      const res = await authGet('/downloads/1', customer.accessToken);

      // Mong đợi 403 (chưa mua / hết lượt) hoặc 404 (doc ko tồn tại)
      expect([400, 403, 404]).toContain(res.status);
    });

    it('❌ Tải tài liệu khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .get('/downloads/1')
        .expect(401);
    });
  });

  // ─── CONFIGS ──────────────────────────────────────────────

  describe('Configs (Admin CRUD)', () => {
    it('✅ Admin xem tất cả configs', async () => {
      if (!adminUser) return;
      const res = await authGet('/configs', adminUser.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin xem config cụ thể', async () => {
      if (!adminUser) return;
      const res = await authGet('/configs/COMMISSION_RATE', adminUser.accessToken)
        .expect(200);

      expect(res.body.config_key || res.body.data?.config_key).toBe('COMMISSION_RATE');
    });

    it('✅ Admin cập nhật config', async () => {
      if (!adminUser) return;
      const res = await authPut('/configs/COMMISSION_RATE', adminUser.accessToken)
        .send({ value: '0.5' })
        .expect(200);

      expect(res.body.message).toBeDefined();
    });

    it('❌ Customer không thể xem configs', async () => {
      await authGet('/configs', customer.accessToken)
        .expect(403);
    });
  });

  // ─── POLICIES ──────────────────────────────────────────────

  describe('Policies', () => {
    it('✅ Xem danh sách policies (public)', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/policies')
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin tạo policy mới', async () => {
      if (!adminUser) return;
      const res = await authPost('/policies', adminUser.accessToken)
        .send({
          title: `Test Policy ${Date.now()}`,
          slug: `test-policy-${Date.now()}`,
          content: 'Nội dung chính sách test...',
          isPublished: true
        })
        .expect(201);

      expect(res.body).toBeDefined();
    });

    it('❌ Customer không thể tạo policy', async () => {
      await authPost('/policies', customer.accessToken)
        .send({
          title: 'Illegal Policy',
          slug: 'illegal',
          content: 'Should fail'
        })
        .expect(403);
    });
  });
});
