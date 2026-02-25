import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем .env из корня монорепо (при запуске из apps/backend или через npm run -w)
config({ path: resolve(__dirname, '..', '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.appSettings.upsert({
    where: { key: 'referralPercent' },
    create: { key: 'referralPercent', value: '10' },
    update: { value: '10' },
  });
  await prisma.appSettings.upsert({
    where: { key: 'referralBonusRub' },
    create: { key: 'referralBonusRub', value: '20' },
    update: { value: '20' },
  });
  await prisma.appSettings.upsert({
    where: { key: 'welcomeBonusRub' },
    create: { key: 'welcomeBonusRub', value: '15' },
    update: { value: '15' },
  });
  await prisma.appSettings.upsert({
    where: { key: 'planPrices' },
    create: {
      key: 'planPrices',
      value: JSON.stringify({ '3d': 60, '1m': 299, '3m': 799, '6m': 1499, '12m': 2499 }),
    },
    update: {
      value: JSON.stringify({ '3d': 60, '1m': 299, '3m': 799, '6m': 1499, '12m': 2499 }),
    },
  });

  let node1 = await prisma.node.findFirst({ where: { name: 'Node NL' } });
  if (!node1) {
    node1 = await prisma.node.create({
      data: {
        name: 'Node NL',
        country: 'NL',
        ip: '1.2.3.4',
        isActive: true,
        loadPercent: 0,
      },
    });
  }

  const user = await prisma.user.upsert({
    where: { telegramId: '123456789' },
    create: {
      telegramId: '123456789',
      username: 'testuser',
      referralCode: 'TEST1234',
      subscriptionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    update: {},
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      nodeId: node1.id,
      plan: '1m',
      price: 299,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
  }).catch(() => {});

  await prisma.user.update({
    where: { id: user.id },
    data: { assignedNodeId: node1.id },
  });

  console.log('Seed done: settings, node (Node NL), test user (telegram 123456789)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
