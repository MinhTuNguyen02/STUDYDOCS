import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Phase 2: Staff accounts (upsert) + Customer accounts & profiles
 */
export async function seedAccounts(prisma: PrismaClient) {
  console.log('\n👤 Phase 2: Accounts & Profiles...');

  const adminRole = await prisma.roles.findUnique({ where: { name: 'ADMIN' } });
  const modRole = await prisma.roles.findUnique({ where: { name: 'MOD' } });
  const accRole = await prisma.roles.findUnique({ where: { name: 'ACCOUNTANT' } });
  const custRole = await prisma.roles.findUnique({ where: { name: 'CUSTOMER' } });

  if (!adminRole || !modRole || !accRole || !custRole) {
    throw new Error('Roles chưa được seed. Hãy chạy Phase 1 trước.');
  }

  // ── Staff accounts (upsert — giữ nguyên nếu đã có) ──
  const staffAccounts = [
    { email: 'admin@studydocs.vn', roleId: adminRole.role_id, name: 'QUẢN TRỊ VIÊN', pwd: 'admin123' },
    { email: 'mod@studydocs.vn', roleId: modRole.role_id, name: 'NV KIỂM DUYỆT', pwd: 'mod123' },
    { email: 'accountant@studydocs.vn', roleId: accRole.role_id, name: 'NV KẾ TOÁN', pwd: 'accountant123' },
  ];

  for (const s of staffAccounts) {
    const existing = await prisma.accounts.findUnique({ where: { email: s.email } });
    if (!existing) {
      const pwdHash = await hash(s.pwd, 10);
      await prisma.accounts.create({
        data: {
          email: s.email,
          password_hash: pwdHash,
          role_id: s.roleId,
          status: 'ACTIVE',
          staff_profiles: { create: { full_name: s.name, is_phone_verified: true } },
        },
      });
    }
  }
  console.log('  ✅ Staff accounts (3 upsert)');

  // ── Customer accounts + profiles + carts + wallets ──
  const customers = [
    { email: 'seller1@gmail.com', name: 'Nguyễn Văn An', status: 'ACTIVE' as const, freeRemaining: 4 },
    { email: 'seller2@gmail.com', name: 'Trần Thị Bình', status: 'ACTIVE' as const, freeRemaining: 4 },
    { email: 'buyer1@gmail.com', name: 'Lê Minh Châu', status: 'ACTIVE' as const, freeRemaining: 3 },
    { email: 'buyer2@gmail.com', name: 'Phạm Đức Dũng', status: 'ACTIVE' as const, freeRemaining: 4 },
    { email: 'testbanned@gmail.com', name: 'Hoàng Test Ban', status: 'BANNED' as const, freeRemaining: 4 },
  ];

  const pwdHash = await hash('password123', 10);

  for (const c of customers) {
    const existing = await prisma.accounts.findUnique({ where: { email: c.email } });
    if (existing) continue;

    await prisma.accounts.create({
      data: {
        email: c.email,
        password_hash: pwdHash,
        role_id: custRole.role_id,
        status: c.status,
        customer_profiles: {
          create: {
            full_name: c.name,
            free_downloads_remaining: c.freeRemaining,
            is_phone_verified: false,
            carts: { create: {} },
            wallets: {
              create: [
                { wallet_type: 'PAYMENT', balance: 0, pending_balance: 0 },
                { wallet_type: 'REVENUE', balance: 0, pending_balance: 0 },
              ],
            },
          },
        },
      },
    });
  }
  console.log('  ✅ Customer accounts + profiles + carts + wallets (5)');
}
