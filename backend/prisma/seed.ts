import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { name: 'CUSTOMER', description: 'Customer account' },
  { name: 'MOD', description: 'Content moderator' },
  { name: 'ACCOUNTANT', description: 'Finance operator' },
  { name: 'ADMIN', description: 'System administrator' }
] as const;

const foundationConfigs = [
  {
    config_key: 'COMMISSION_RATE',
    config_value: '0.5',
    description: 'Marketplace commission rate (0 to 1)'
  },
  {
    config_key: 'MIN_WITHDRAWAL',
    config_value: '200000',
    description: 'Minimum withdrawal amount in VND'
  },
  {
    config_key: 'WITHDRAWAL_FEE_RATE',
    config_value: '0.0',
    description: 'Withdrawal fee/tax rate (0 to 1)'
  }
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production.');
  }
  if (process.env.ALLOW_SEED !== 'true') {
    throw new Error('Set ALLOW_SEED=true explicitly to run the idempotent foundation seed.');
  }

  await prisma.$transaction([
    ...roles.map((role) =>
      prisma.roles.upsert({
        where: { name: role.name },
        create: role,
        update: { description: role.description }
      })
    ),
    ...foundationConfigs.map((config) =>
      prisma.configs.upsert({
        where: { config_key: config.config_key },
        create: config,
        update: { description: config.description }
      })
    )
  ]);

  console.info(`Seeded ${roles.length} roles and ${foundationConfigs.length} foundation configs.`);

  await prisma.$transaction(async (tx) => {
    // Serialize foundation seeding even if two deploy jobs start concurrently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(781325194)`;

    const systemWalletTypes = ['GATEWAY_POOL', 'SYSTEM_REVENUE', 'TAX_PAYABLE'] as const;
    for (const walletType of systemWalletTypes) {
      const existing = await tx.wallets.findFirst({
        where: { wallet_type: walletType, customer_id: null }
      });
      if (!existing) {
        await tx.wallets.create({ data: { wallet_type: walletType, balance: 0 } });
        console.info(`Created system wallet: ${walletType}`);
      }
    }
  });

  console.info('Foundation seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
