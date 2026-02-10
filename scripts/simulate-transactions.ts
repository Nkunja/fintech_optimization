#!/usr/bin/env ts-node

/**
 * Simulate Transactions Script
 *
 * Simulates usage by incrementing usedCashbackBudget, usedOfferBudget, and
 * pointsUsedInPeriod on existing offers. Run after seed-offers. Optional --count
 * to run multiple rounds.
 *
 * Usage:
 *   npm run simulate-transactions
 *   npx ts-node scripts/simulate-transactions.ts --count 5
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(): { count: number } {
  const args = process.argv.slice(2);
  let count = 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      count = Math.max(1, parseInt(args[i + 1], 10));
      i++;
    }
  }
  return { count };
}

async function main() {
  const { count } = parseArgs();

  const cashbackConfigs = await prisma.cashbackConfiguration.findMany({
    where: { isActive: true },
    select: { id: true, name: true, netCashbackBudget: true, usedCashbackBudget: true },
  });
  const exclusiveOffers = await prisma.exclusiveOffer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, netOfferBudget: true, usedOfferBudget: true },
  });
  const loyaltyPrograms = await prisma.loyaltyProgram.findMany({
    where: { isActive: true },
    select: { id: true, name: true, pointsUsedInPeriod: true },
  });

  if (
    cashbackConfigs.length === 0 &&
    exclusiveOffers.length === 0 &&
    loyaltyPrograms.length === 0
  ) {
    console.error('No offers found. Run: npm run seed-offers');
    process.exit(1);
  }

  console.log(`Simulating transactions (${count} round(s))...\n`);

  for (let round = 0; round < count; round++) {
    // Cashback: add 10–50 to used budget
    for (const c of cashbackConfigs) {
      const used = Number(c.usedCashbackBudget);
      const net = Number(c.netCashbackBudget);
      if (used >= net) continue;
      const add = Math.min(10 + Math.floor(Math.random() * 41), Number(net - used));
      await prisma.cashbackConfiguration.update({
        where: { id: c.id },
        data: { usedCashbackBudget: { increment: add } },
      });
      console.log(`  Cashback  ${c.name}: +${add}`);
    }

    // Exclusive: add 5–25 to used budget
    for (const e of exclusiveOffers) {
      const used = Number(e.usedOfferBudget);
      const net = Number(e.netOfferBudget);
      if (used >= net) continue;
      const add = Math.min(5 + Math.floor(Math.random() * 21), Number(net - used));
      await prisma.exclusiveOffer.update({
        where: { id: e.id },
        data: { usedOfferBudget: { increment: add } },
      });
      console.log(`  Exclusive ${e.name}: +${add}`);
    }

    // Loyalty: add 20–100 points used
    for (const l of loyaltyPrograms) {
      const add = 20 + Math.floor(Math.random() * 81);
      await prisma.loyaltyProgram.update({
        where: { id: l.id },
        data: { pointsUsedInPeriod: { increment: add } },
      });
      console.log(`  Loyalty   ${l.name}: +${add} points`);
    }

    if (count > 1 && round < count - 1) console.log('');
  }

  console.log('\nDone. Budgets/points updated. Re-run anytime to simulate more usage.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
