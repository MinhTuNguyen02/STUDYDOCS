import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Phase 1: Foundation — roles, configs, policies
 * Upsert để không trùng lặp với dữ liệu đã có.
 */
export async function seedFoundation(prisma: PrismaClient) {
  console.log('\n📦 Phase 1: Foundation (roles, configs, policies)...');

  // ── Roles (giữ nguyên IDs hiện tại: 1, 3, 4, 5) ──
  const roles = [
    { name: 'CUSTOMER', description: 'Quyen CUSTOMER' },
    { name: 'MOD', description: 'Quyen MOD' },
    { name: 'ADMIN', description: 'Quyen ADMIN' },
    { name: 'ACCOUNTANT', description: 'Quyen ACCOUNTANT' },
  ];
  for (const r of roles) {
    await prisma.roles.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description },
    });
  }
  console.log('  ✅ Roles (4)');

  // ── Configs ──
  const configs = [
    { key: 'COMMISSION_RATE', value: '0.50', desc: 'Phi nen tang 50%' },
    { key: 'WITHDRAWAL_FEE_RATE', value: '0.10', desc: 'Thue rut tien 10%' },
    { key: 'MIN_WITHDRAWAL', value: '200000', desc: 'Rut tien toi thieu 200k' },
    { key: 'HOLD_DURATION_HOURS', value: '48', desc: 'Thoi gian giu tien' },
  ];
  for (const c of configs) {
    await prisma.configs.upsert({
      where: { config_key: c.key },
      update: {},
      create: { config_key: c.key, config_value: c.value, description: c.desc },
    });
  }
  console.log('  ✅ Configs (4)');

  // ── Policies ──
  const policies = [
    { title: 'Điều khoản sử dụng', slug: 'dieu-khoan-su-dung', content: '<p>Nội dung điều khoản sử dụng của StudyDocs.</p>' },
    { title: 'Chính sách bảo mật', slug: 'chinh-sach-bao-mat', content: '<p>Nội dung chính sách bảo mật của StudyDocs.</p>' },
    { title: 'Quy định rút tiền', slug: 'quy-dinh-rut-tien', content: '<p>Nội dung quy định rút tiền của StudyDocs.</p>' },
  ];
  for (const p of policies) {
    await prisma.policies.upsert({
      where: { slug: p.slug },
      update: {},
      create: { title: p.title, slug: p.slug, content: p.content, is_active: true },
    });
  }
  console.log('  ✅ Policies (3)');

  // ── System Wallets ──
  for (const wt of ['GATEWAY_POOL', 'SYSTEM_REVENUE', 'TAX_PAYABLE'] as const) {
    const existing = await prisma.wallets.findFirst({ where: { wallet_type: wt } });
    if (!existing) {
      await prisma.wallets.create({
        data: { wallet_type: wt, balance: 0, pending_balance: 0 },
      });
    }
  }
  console.log('  ✅ System Wallets (3)');
}
