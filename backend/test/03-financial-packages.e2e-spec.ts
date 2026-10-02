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

describe('PHẦN 3: Financial, Packages & Downloads (e2e)', () => {
  let customer: TestUser;
  let seller: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    await createTestApp();
    customer = await registerAndLogin(
      `finance_${Date.now()}@test.com`,
      'Finance@123',
      'Finance User'
    );
    seller = await registerAndLogin(
      `download_seller_${Date.now()}@test.com`,
      'Seller@123',
      'Download Seller'
    );
    adminUser = await ensureTestStaff('admin-finance-e2e@studydocs.test', 'Admin@Test123', 'ADMIN');
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── WALLETS ──────────────────────────────────────────────

  describe('GET /wallets/me', () => {
    it('✅ Xem ví của tôi (PAYMENT + REVENUE)', async () => {
      const res = await authGet('/wallets/me', customer.accessToken).expect(200);

      const wallets = res.body.data;
      expect(wallets).toBeDefined();
      expect(wallets.length).toBeGreaterThanOrEqual(2);

      const types = wallets.map((w: any) => w.wallet_type);
      expect(types).toContain('PAYMENT');
      expect(types).toContain('REVENUE');
    });

    it('❌ Xem ví khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer()).get('/wallets/me').expect(401);
    });
  });

  // ─── LEDGER HISTORY ────────────────────────────────────────

  describe('GET /wallets/transactions/me', () => {
    it('✅ Xem lịch sử giao dịch (có thể trống)', async () => {
      const res = await authGet('/wallets/transactions/me', customer.accessToken).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── WITHDRAWALS ──────────────────────────────────────────

  describe('Withdrawal Flow', () => {
    it('❌ Rút tiền thất bại: số dư không đủ', async () => {
      const res = await authPost('/wallets/withdrawals', customer.accessToken).send({
        amount: 500000,
        bankInfo: { bank: 'VCB', account: '123456' }
      });
      expect([400, 403]).toContain(res.status);
    });

    it('❌ Rút tiền thất bại: dưới mức tối thiểu', async () => {
      const res = await authPost('/wallets/withdrawals', customer.accessToken).send({
        amount: 1000,
        bankInfo: { bank: 'VCB', account: '123456' }
      });
      expect([400, 403]).toContain(res.status);
    });

    it('✅ Xem danh sách yêu cầu rút tiền (có thể trống)', async () => {
      const res = await authGet('/wallets/withdrawals/me', customer.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ─── WITHDRAWAL PROCESSING (Accountant/Admin) ────────────

  describe('PATCH /wallets/withdrawals/:id', () => {
    it('✅ Admin xem withdrawal có filter và phân trang server-side', async () => {
      const res = await authGet(
        '/admin/withdrawals?status=PENDING&page=1&limit=10',
        adminUser.accessToken
      ).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 10 }));
    });

    it('❌ Từ chối withdrawal query không hợp lệ', async () => {
      await authGet('/admin/withdrawals?status=UNKNOWN', adminUser.accessToken).expect(400);
    });

    it('❌ Customer không thể duyệt withdrawal', async () => {
      await authPatch('/wallets/withdrawals/1', customer.accessToken)
        .send({ status: 'PAID' })
        .expect(403);
    });
  });

  // ─── PACKAGES ──────────────────────────────────────────────

  describe('Packages CRUD', () => {
    let packageId: number;

    it('✅ Xem danh sách gói active (public)', async () => {
      const res = await authGet('/packages', customer.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin xem tất cả gói (gồm inactive)', async () => {
      if (!adminUser) return;
      const res = await authGet('/packages/admin/all', adminUser.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin tạo gói mới', async () => {
      if (!adminUser) return;
      const res = await authPost('/packages', adminUser.accessToken)
        .send({
          name: `Test Package ${Date.now()}`,
          description: 'Gói test tải xuống',
          price: 50000,
          download_turns: 10,
          duration_days: 30
        })
        .expect(201);

      expect(res.body.package_id || res.body.data?.package_id).toBeDefined();
      packageId = res.body.package_id || res.body.data?.package_id;
    });

    it('❌ Mua gói thất bại: không đủ tiền', async () => {
      if (!packageId) return;
      await authPost(`/packages/${packageId}/buy`, customer.accessToken)
        .send({ idempotencyKey: '614a89cb-15e5-4f95-9dbe-50c0ade147aa' })
        .expect(400);
    });

    it('❌ Mua gói thất bại: gói không tồn tại', async () => {
      await authPost('/packages/999999/buy', customer.accessToken)
        .send({ idempotencyKey: '826f2a4b-eb25-4a42-9abe-083219d8a9be' })
        .expect(404);
    });

    it('✅ Request mua gói đồng thời cùng idempotency key chỉ trừ tiền một lần', async () => {
      if (!packageId || !customer.customerId)
        throw new Error('Missing package/customer test fixture');
      const prisma = getApp().get(PrismaService);
      const wallet = await prisma.wallets.update({
        where: {
          customer_id_wallet_type: {
            customer_id: customer.customerId,
            wallet_type: 'PAYMENT'
          }
        },
        data: { balance: 100000 }
      });
      const idempotencyKey = 'e3c24172-1d58-45f6-8156-caa535107f70';

      const responses = await Promise.all([
        authPost(`/packages/${packageId}/buy`, customer.accessToken).send({ idempotencyKey }),
        authPost(`/packages/${packageId}/buy`, customer.accessToken).send({ idempotencyKey })
      ]);

      expect(responses.every((response) => response.status === 201)).toBe(true);
      expect(responses.filter((response) => response.body.replayed === false)).toHaveLength(1);
      expect(
        await prisma.user_packages.count({
          where: { customer_id: customer.customerId, idempotency_key: idempotencyKey }
        })
      ).toBe(1);
      const updatedWallet = await prisma.wallets.findUniqueOrThrow({
        where: { wallet_id: wallet.wallet_id }
      });
      expect(updatedWallet.balance.toNumber()).toBe(50000);
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
    it('✅ Hai request đồng thời chỉ tiêu thụ một lượt package cho cùng tài liệu', async () => {
      if (!customer.customerId || !seller.customerId) {
        throw new Error('Missing customer/seller test fixture');
      }
      const prisma = getApp().get(PrismaService);
      const storage = getApp().get(StorageService);
      const signedUrlSpy = jest
        .spyOn(storage, 'getPresignedUrl')
        .mockResolvedValue('http://127.0.0.1/test-download.pdf');

      try {
        const category = await prisma.categories.findFirstOrThrow();
        const activePackage = await prisma.user_packages.findFirstOrThrow({
          where: { customer_id: customer.customerId, status: 'ACTIVE' }
        });
        const beforeTurns = activePackage.turns_remaining;
        const document = await prisma.documents.create({
          data: {
            seller_id: seller.customerId,
            category_id: category.category_id,
            title: `Concurrent download ${Date.now()}`,
            slug: `concurrent-download-${Date.now()}`,
            description: 'Concurrent entitlement test document',
            price: 10000,
            page_count: 1,
            status: 'APPROVED',
            file_url: 'private/test-download.pdf',
            file_extension: 'pdf',
            file_hash: `${Date.now()}`.padEnd(64, '0').slice(0, 64),
            published_at: new Date()
          }
        });

        const responses = await Promise.all([
          authGet(`/downloads/${document.document_id}`, customer.accessToken),
          authGet(`/downloads/${document.document_id}`, customer.accessToken)
        ]);

        expect(responses.every((response) => response.status === 200)).toBe(true);
        expect(
          await prisma.download_history.count({
            where: { customer_id: customer.customerId, document_id: document.document_id }
          })
        ).toBe(2);
        const updatedPackage = await prisma.user_packages.findUniqueOrThrow({
          where: { user_package_id: activePackage.user_package_id }
        });
        expect(updatedPackage.turns_remaining).toBe(beforeTurns - 1);
        const updatedDocument = await prisma.documents.findUniqueOrThrow({
          where: { document_id: document.document_id }
        });
        expect(updatedDocument.download_count).toBe(1);
      } finally {
        signedUrlSpy.mockRestore();
      }
    });

    it('❌ Tải tài liệu chưa mua: bị chặn', async () => {
      const res = await authGet('/downloads/999999', customer.accessToken);

      // Mong đợi 403 (chưa mua / hết lượt) hoặc 404 (doc ko tồn tại)
      expect([400, 403, 404]).toContain(res.status);
    });

    it('❌ Tải tài liệu khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer()).get('/downloads/1').expect(401);
    });
  });

  // ─── CONFIGS ──────────────────────────────────────────────

  describe('Configs (Admin CRUD)', () => {
    it('✅ Admin xem tất cả configs', async () => {
      if (!adminUser) return;
      const res = await authGet('/configs', adminUser.accessToken).expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin xem config cụ thể', async () => {
      if (!adminUser) return;
      const res = await authGet('/configs/COMMISSION_RATE', adminUser.accessToken).expect(200);

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
      await authGet('/configs', customer.accessToken).expect(403);
    });
  });

  // ─── POLICIES ──────────────────────────────────────────────

  describe('Policies', () => {
    it('✅ Xem danh sách policies (public)', async () => {
      const res = await request(getApp().getHttpServer()).get('/policies').expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Admin tạo policy mới', async () => {
      if (!adminUser) return;
      const res = await authPost('/policies', adminUser.accessToken)
        .send({
          title: `Test Policy ${Date.now()}`,
          slug: `test-policy-${Date.now()}`,
          content: 'Nội dung chính sách test...',
          isActive: true
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
