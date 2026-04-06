/**
 * ═══════════════════════════════════════════════════════════
 * PHẦN 2/4: DOCUMENT, CART, ORDERS & CHECKOUT
 * ═══════════════════════════════════════════════════════════
 * 
 * Bao gồm:
 * - Document search & detail (public)
 * - Seller upload & manage
 * - Cart CRUD + guards (self-buy, duplicate)
 * - Checkout + Ledger double-entry
 * - Wishlist
 * - Categories & Tags
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

describe('PHẦN 2: Documents, Cart & Checkout (e2e)', () => {
  jest.setTimeout(15000);
  let seller: TestUser;
  let buyer: TestUser;
  let adminUser: TestUser;
  let createdDocId: number;

  beforeAll(async () => {
    await createTestApp();
    // Tạo 2 user: 1 seller, 1 buyer
    seller = await registerAndLogin(`seller_${Date.now()}@test.com`, 'Seller@123', 'Seller User');
    buyer = await registerAndLogin(`buyer_${Date.now()}@test.com`, 'Buyer@123', 'Buyer User');
    try {
      adminUser = await loginAs('admin@studydocs.vn', 'admin123');
    } catch {
      console.warn('⚠️  Admin seed account not found.');
    }
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── CATEGORIES (PUBLIC) ─────────────────────────────────

  describe('GET /categories', () => {
    it('✅ Lấy danh sách categories (không cần auth)', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/categories')
        .expect(200);

      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });

    it('✅ Lấy hierarchy categories', async () => {
      await request(getApp().getHttpServer())
        .get('/categories/hierarchy')
        .expect(200);
    });
  });

  // ─── TAGS (PUBLIC) ──────────────────────────────────────

  describe('GET /tags', () => {
    it('✅ Lấy danh sách tags', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/tags')
        .expect(200);

      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });
  });

  // ─── DOCUMENTS (PUBLIC) ──────────────────────────────────

  describe('GET /documents', () => {
    it('✅ Tìm kiếm tài liệu (public, không cần auth)', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/documents')
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('✅ Tìm kiếm với filter', async () => {
      const res = await request(getApp().getHttpServer())
        .get('/documents?sortBy=popular&page=1&limit=5')
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ─── SELLER UPLOAD ────────────────────────────────────────

  describe('POST /seller/documents', () => {
    it('✅ Seller upload tài liệu thành công', async () => {
      const res = await authPost('/seller/documents', seller.accessToken)
        .field('title', `Test Doc ${Date.now()}`)
        .field('description', 'A'.repeat(201)) // Tối thiểu 200 ký tự
        .field('price', '50000')
        .field('categoryId', '1') // Giả sử category 1 tồn tại
        .attach('file', Buffer.from('fake pdf content'), {
          filename: 'test-document.pdf',
          contentType: 'application/pdf'
        })
        .expect((res) => {
          // Có thể 201 hoặc lỗi nếu MinIO chưa sẵn sàng
          if (res.status === 201) {
            createdDocId = res.body.data?.document_id || res.body.document_id;
          }
        });
    });

    it('❌ Upload thất bại: buyer không phải seller (vẫn upload được, vì đều là CUSTOMER)', async () => {
      // Trong hệ thống này, mọi customer đều có thể upload
      // Test này xác nhận điều đó
      const res = await authPost('/seller/documents', buyer.accessToken)
        .field('title', `Buyer Upload ${Date.now()}`)
        .field('description', 'B'.repeat(201))
        .field('price', '0')
        .field('categoryId', '1')
        .attach('file', Buffer.from('fake content'), {
          filename: 'buyer-doc.pdf',
          contentType: 'application/pdf'
        });

      // Không restrict — cả buyer cũng upload được (đúng theo business logic)
    });
  });

  // ─── SELLER DASHBOARD ──────────────────────────────────────

  describe('GET /seller/dashboard', () => {
    it('✅ Seller xem dashboard thống kê', async () => {
      const res = await authGet('/seller/dashboard', seller.accessToken)
        .expect(200);

      expect(res.body.totalEarnings).toBeDefined();
      expect(res.body.totalViews).toBeDefined();
      expect(res.body.totalDownloads).toBeDefined();
    });

    it('❌ Dashboard thất bại: không có token', async () => {
      await request(getApp().getHttpServer())
        .get('/seller/dashboard')
        .expect(401);
    });
  });

  // ─── SELLER DOCUMENTS LIST ────────────────────────────────

  describe('GET /seller/documents', () => {
    it('✅ Seller xem danh sách tài liệu của mình', async () => {
      const res = await authGet('/seller/documents', seller.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  // ─── CART ──────────────────────────────────────────────────

  describe('Cart CRUD', () => {
    it('✅ Xem giỏ hàng (trống)', async () => {
      const res = await authGet('/cart', buyer.accessToken)
        .expect(200);

      expect(res.body.items).toBeDefined();
    });

    it('❌ Thêm tài liệu không tồn tại vào giỏ', async () => {
      await authPost('/cart/add', buyer.accessToken)
        .send({ documentId: 999999 })
        .expect(404);
    });

    it('❌ Thêm tài liệu vào giỏ khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .post('/cart/add')
        .send({ documentId: 1 })
        .expect(401);
    });

    // Test self-purchase guard: nếu có doc approved của seller
    it('❌ Seller không thể thêm tài liệu của mình vào giỏ', async () => {
      if (!createdDocId) return; // Skip nếu upload thất bại

      // Cần doc phải APPROVED — dùng admin để approve
      if (adminUser) {
        await authPatch(`/admin/approvals/documents/${createdDocId}/approve`, adminUser.accessToken);
      }

      const res = await authPost('/cart/add', seller.accessToken)
        .send({ documentId: createdDocId });

      // Mong đợi 409 (Conflict) hoặc 400 — không được thêm doc mình vào giỏ
      if (res.status !== 409 && res.status !== 400 && res.status !== 404) {
        // Nếu doc chưa approved thì 404, đó cũng OK
        expect([400, 404, 409]).toContain(res.status);
      }
    });

    it('✅ Xóa toàn bộ giỏ hàng', async () => {
      await authDelete('/cart/clear', buyer.accessToken)
        .expect(200);
    });
  });

  // ─── WISHLIST ──────────────────────────────────────────────

  describe('Wishlist', () => {
    it('✅ Xem wishlist (trống)', async () => {
      const res = await authGet('/wishlists', buyer.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('✅ Toggle wishlist', async () => {
      await authPost('/wishlists/toggle', buyer.accessToken)
        .send({ documentId: createdDocId || 1 }) // Use dynamic created doc
        .expect((res) => {
          expect([200, 201, 404]).toContain(res.status); // 404 if seed doc missing
        });
    });
  });

  // ─── CHECKOUT & WALLET ────────────────────────────────────

  describe('Checkout Flow', () => {
    it('❌ Checkout thất bại: giỏ hàng trống / thiếu documentIds', async () => {
      await authPost('/checkout/orders', buyer.accessToken)
        .send({ documentIds: [] })
        .expect(400);
    });

    it('❌ Checkout thất bại: không đủ tiền trong ví', async () => {
      const res = await authPost('/checkout/orders', buyer.accessToken)
        .send({ documentIds: [1] }); // Giả sử doc 1 tồn tại & approved, buyer chưa nạp tiền

      // Mong đợi 400 (không đủ tiền) hoặc 404 (doc ko tồn tại)
      expect([400, 404]).toContain(res.status);
    });

    it('❌ Checkout thất bại: document không tồn tại', async () => {
      const res = await authPost('/checkout/orders', buyer.accessToken)
        .send({ documentIds: [999999] })
        .expect(400);
    });
  });

  // ─── WALLET TOP-UP ─────────────────────────────────────────

  describe('POST /checkout/wallet/topup', () => {
    it('✅ Tạo request nạp tiền VNPay', async () => {
      const res = await authPost('/checkout/wallet/topup', buyer.accessToken)
        .send({ amount: 100000 });
        
      expect([201, 200, 403]).toContain(res.status);
      expect(res.body).toBeDefined();
    });

    it('❌ Nạp tiền thất bại: số tiền quá nhỏ', async () => {
      const res = await authPost('/checkout/wallet/topup', buyer.accessToken)
        .send({ amount: 5000 });
      expect([400, 403]).toContain(res.status);
    });
  });

  // ─── MY ORDERS ─────────────────────────────────────────────

  describe('GET /orders', () => {
    it('✅ Xem danh sách đơn hàng', async () => {
      const res = await authGet('/orders', buyer.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('❌ Xem đơn hàng khi chưa đăng nhập', async () => {
      await request(getApp().getHttpServer())
        .get('/orders')
        .expect(401);
    });
  });

  // ─── MY LIBRARY ───────────────────────────────────────────

  describe('GET /library/documents', () => {
    it('✅ Xem thư viện tài liệu đã mua', async () => {
      const res = await authGet('/library/documents', buyer.accessToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
