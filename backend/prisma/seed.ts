import { PrismaClient } from '@prisma/client';
import { seedFoundation } from './seed-data/01-foundation.seed';
import { seedAccounts } from './seed-data/02-accounts.seed';
import { seedWallets } from './seed-data/03-wallets.seed';
import { seedCatalog } from './seed-data/04-catalog.seed';
import { seedDocuments } from './seed-data/05-documents.seed';
import { seedOrders } from './seed-data/06-orders.seed';
import { seedLedger } from './seed-data/07-ledger.seed';
import { seedInteractions } from './seed-data/08-interactions.seed';
import { seedModeration } from './seed-data/09-moderation.seed';
import { seedNotifications } from './seed-data/10-notifications.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 ═══════════════════════════════════════');
  console.log('   STUDYDOCS — SEED DATA v2');
  console.log('═══════════════════════════════════════════');

  await seedFoundation(prisma);
  await seedAccounts(prisma);
  await seedWallets(prisma);
  await seedCatalog(prisma);
  await seedDocuments(prisma);
  await seedOrders(prisma);
  await seedLedger(prisma);
  await seedInteractions(prisma);
  await seedModeration(prisma);
  await seedNotifications(prisma);

  console.log('\n✅ ═══════════════════════════════════════');
  console.log('   SEEDING COMPLETED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
