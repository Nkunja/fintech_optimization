#!/usr/bin/env ts-node

/**
 * Seed Offers Script
 *
 * Creates cashback configs, exclusive offers, and loyalty programs for existing
 * merchants/outlets. Run after seed-merchants. Then run load-users and optionally
 * simulate-transactions.
 *
 * Usage: npm run seed-offers
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_USER_IDS = ['user-dev-001', 'user-dev-002', 'user-dev-003', 'user-dev-004', 'user-dev-005'];

async function main() {
  const merchants = await prisma.merchant.findMany({
    where: { status: 'Active' },
    include: { Outlets: { where: { isActive: true }, take: 1 } },
  });

  const withOutlets = merchants.filter((m) => m.Outlets.length > 0);
  if (withOutlets.length === 0) {
    console.error('No active merchants with outlets. Run: npm run seed-merchants');
    process.exit(1);
  }

  console.log(`Seeding offers for ${withOutlets.length} merchant(s)...\n`);

  for (const merchant of withOutlets) {
    const existing = await prisma.cashbackConfiguration.findFirst({
      where: { merchantId: merchant.id },
    });
    if (existing) {
      console.log(`  Skip:     ${merchant.businessName} (already has offers)`);
      continue;
    }

    const outlet = merchant.Outlets[0];
    const outletId = outlet.id;

    // 1. Cashback configuration + tiers
    const cashback = await prisma.cashbackConfiguration.create({
      data: {
        name: `${merchant.businessName} Cashback`,
        description: `5–10% cashback at ${merchant.businessName}`,
        merchantId: merchant.id,
        netCashbackBudget: 5000,
        usedCashbackBudget: 0,
        eligibleCustomerTypes: ['New', 'Regular', 'Vip', 'Occasional'],
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        Outlets: { connect: [{ id: outletId }] },
        CashbackConfigurationTiers: {
          create: [
            { cashbackPercentage: 5, minTransactionAmount: 0, maxTransactionAmount: 99.99 },
            { cashbackPercentage: 10, minTransactionAmount: 100 },
          ],
        },
      },
      include: { CashbackConfigurationTiers: true },
    });
    console.log(`  Cashback:  ${cashback.name} (${cashback.CashbackConfigurationTiers.length} tiers)`);

    // 2. Exclusive offer
    const exclusive = await prisma.exclusiveOffer.create({
      data: {
        name: `Welcome offer – ${merchant.businessName}`,
        description: `First purchase discount at ${merchant.businessName}`,
        merchantId: merchant.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        netOfferBudget: 2000,
        usedOfferBudget: 0,
        eligibleCustomerTypes: ['New', 'Occasional'],
        Outlets: { connect: [{ id: outletId }] },
      },
    });
    console.log(`  Exclusive: ${exclusive.name}`);

    // 3. Loyalty program + tier + reward
    const loyalty = await prisma.loyaltyProgram.create({
      data: {
        name: `${merchant.businessName} Rewards`,
        description: `Earn points at ${merchant.businessName}`,
        merchantId: merchant.id,
        pointsIssuedLimit: 10000,
        pointsUsedInPeriod: 0,
        LoyaltyTiers: {
          create: [{ name: 'Member', minCustomerType: 'New' }],
        },
        MerchantLoyaltyRewards: {
          create: [
            { name: 'Free item', pointsCost: 100 },
            { name: '10% off', pointsCost: 50 },
          ],
        },
      },
    });
    console.log(`  Loyalty:   ${loyalty.name}`);

    // 4. UserOfferEligibility for test users (so offers query returns data)
    const now = new Date();
    for (const userId of TEST_USER_IDS) {
      await prisma.userOfferEligibility.createMany({
        data: [
          {
            userId,
            outletId,
            offerType: 'CASHBACK',
            offerId: cashback.id,
            merchantId: merchant.id,
            merchantCategory: merchant.category,
            merchantName: merchant.businessName,
            outletName: outlet.name,
            minPercentage: 5,
            maxPercentage: 10,
            hasBudgetRemaining: true,
          },
          {
            userId,
            outletId,
            offerType: 'EXCLUSIVE',
            offerId: exclusive.id,
            merchantId: merchant.id,
            merchantCategory: merchant.category,
            merchantName: merchant.businessName,
            outletName: outlet.name,
            hasBudgetRemaining: true,
          },
          {
            userId,
            outletId,
            offerType: 'LOYALTY',
            offerId: loyalty.id,
            merchantId: merchant.id,
            merchantCategory: merchant.category,
            merchantName: merchant.businessName,
            outletName: outlet.name,
            hasBudgetRemaining: true,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  const eligibilityCount = await prisma.userOfferEligibility.count();
  console.log(`\nDone. UserOfferEligibility records: ${eligibilityCount}`);
  console.log('Run: npm run simulate-transactions (optional), then query offers with X-Test-User-Id header.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
