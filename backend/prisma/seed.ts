import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- START SEEDING ---');

  // 1. Roles — CHỈ CÓ 4 ROLES
  const roles = ['CUSTOMER', 'MOD', 'ADMIN', 'ACCOUNTANT'];
  for (const roleName of roles) {
    await prisma.roles.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `Quyen ${roleName}` }
    });
  }
  console.log('✅ Roles seeded (4 roles: CUSTOMER, MOD, ADMIN, ACCOUNTANT).');

  // 2. Configs
  const configs = [
    { key: 'COMMISSION_RATE', value: '0.50', desc: 'Phi nen tang 50%' },
    { key: 'WITHDRAWAL_FEE_RATE', value: '0.10', desc: 'Thue rut tien 10%' },
    { key: 'MIN_WITHDRAWAL', value: '200000', desc: 'Rut tien toi thieu 200k' },
    { key: 'HOLD_DURATION_HOURS', value: '48', desc: 'Thoi gian giu tien' }
  ];
  for (const c of configs) {
    await prisma.configs.upsert({
      where: { config_key: c.key },
      update: {},
      create: { config_key: c.key, config_value: c.value, description: c.desc }
    });
  }
  console.log('✅ Configs seeded.');

  // 3. System Wallets (with customer_id = null)
  // GATEWAY_POOL
  const existingGateway = await prisma.wallets.findFirst({
    where: { wallet_type: 'GATEWAY_POOL' }
  });
  if (!existingGateway) {
    await prisma.wallets.create({
      data: {
        wallet_type: 'GATEWAY_POOL',
        balance: 0,
        pending_balance: 0
      }
    });
    console.log('✅ System Wallet GATEWAY_POOL seeded.');
  }

  // SYSTEM_REVENUE
  const existingRevenue = await prisma.wallets.findFirst({
    where: { wallet_type: 'SYSTEM_REVENUE' }
  });
  if (!existingRevenue) {
    await prisma.wallets.create({
      data: {
        wallet_type: 'SYSTEM_REVENUE',
        balance: 0,
        pending_balance: 0
      }
    });
    console.log('✅ System Wallet SYSTEM_REVENUE seeded.');
  }

  // 4. Staff Accounts
  const adminRole = await prisma.roles.findUnique({ where: { name: 'ADMIN' } });
  const modRole = await prisma.roles.findUnique({ where: { name: 'MOD' } });
  const accountantRole = await prisma.roles.findUnique({ where: { name: 'ACCOUNTANT' } });

  if (adminRole && modRole && accountantRole) {
    // Admin
    const adminEmail = 'admin@studydocs.vn';
    const existingAdmin = await prisma.accounts.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const pwd = await hash('admin123', 10);
      await prisma.accounts.create({
        data: {
          email: adminEmail,
          password_hash: pwd,
          role_id: adminRole.role_id,
          status: 'ACTIVE',
          staff_profiles: { create: { full_name: 'Admin User' } }
        }
      });
      console.log('✅ Admin account seeded.');
    }

    // MOD
    const modEmail = 'mod@studydocs.vn';
    const existingMod = await prisma.accounts.findUnique({ where: { email: modEmail } });
    if (!existingMod) {
      const pwd = await hash('mod123', 10);
      await prisma.accounts.create({
        data: {
          email: modEmail,
          password_hash: pwd,
          role_id: modRole.role_id,
          status: 'ACTIVE',
          staff_profiles: { create: { full_name: 'Moderator User' } }
        }
      });
      console.log('✅ MOD account seeded.');
    }

    // Accountant
    const accEmail = 'accountant@studydocs.vn';
    const existingAcc = await prisma.accounts.findUnique({ where: { email: accEmail } });
    if (!existingAcc) {
      const pwd = await hash('accountant123', 10);
      await prisma.accounts.create({
        data: {
          email: accEmail,
          password_hash: pwd,
          role_id: accountantRole.role_id,
          status: 'ACTIVE',
          staff_profiles: { create: { full_name: 'Accountant User' } }
        }
      });
      console.log('✅ Accountant account seeded.');
    }
  }

  // 5. Policies
  const policies = [
    { title: 'Điều khoản sử dụng', slug: 'dieu-khoan-su-dung', content: '<p>Nội dung điều khoản sử dụng của StudyDocs.</p>' },
    { title: 'Chính sách bảo mật', slug: 'chinh-sach-bao-mat', content: '<p>Nội dung chính sách bảo mật của StudyDocs.</p>' },
    { title: 'Quy định rút tiền', slug: 'quy-dinh-rut-tien', content: '<p>Nội dung quy định rút tiền của StudyDocs.</p>' }
  ];

  for (const p of policies) {
    await prisma.policies.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        title: p.title,
        slug: p.slug,
        content: p.content,
        is_active: true
      }
    });
  }
  console.log('✅ Policies seeded.');

  console.log('--- SEEDING COMPLETED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
