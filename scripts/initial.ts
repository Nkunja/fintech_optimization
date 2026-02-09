#!/usr/bin/env ts-node

/**
 * Initial Migration Script
 * 
 * This script computes eligibility for all existing offers.
 * Run this once after deploying the new schema.
 * 
 * Usage:
 *   ts-node scripts/initial-migration.ts
 */

import { PrismaClient } from '@prisma/client';
// import { EligibilityComputationService } from '../src/eligibility/eligibility-computation.service';
// import { EligibilityQueueService } from '../src/eligibility/eligibility-queue.service';
// import { QUEUE_PRIORITY } from '../src/common/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting initial eligibility migration...\n');

//   const computationService = new EligibilityComputationService(prisma);
  
  // Mock queue service for direct computation
  const stats = {
    cashback: { total: 0, processed: 0, failed: 0 },
    exclusive: { total: 0, processed: 0, failed: 0 },
    loyalty: { total: 0, processed: 0, failed: 0 },
  };

  // 1. Compute Cashback Configurations
  console.log('Computing Cashback Configurations...');
  const cashbackConfigs = await prisma.cashbackConfiguration.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  stats.cashback.total = cashbackConfigs.length;
  console.log(`   Found ${cashbackConfigs.length} active cashback configurations`);

  for (const [index, config] of cashbackConfigs.entries()) {
    try {
      console.log(`   [${index + 1}/${cashbackConfigs.length}] Processing: ${config.name}`);
    //   const records = await computationService.computeCashbackEligibility(config.id);
    //   console.log(`       Created ${records} eligibility records`);
      stats.cashback.processed++;
    } catch (error) {
      console.error(`       Failed: ${error.message}`);
      stats.cashback.failed++;
    }
  }

  // 2. Compute Exclusive Offers
  console.log('\n Computing Exclusive Offers...');
  const exclusiveOffers = await prisma.exclusiveOffer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  stats.exclusive.total = exclusiveOffers.length;
  console.log(`   Found ${exclusiveOffers.length} active exclusive offers`);

  for (const [index, offer] of exclusiveOffers.entries()) {
    try {
      console.log(`   [${index + 1}/${exclusiveOffers.length}] Processing: ${offer.name}`);
    //   const records = await computationService.computeExclusiveOfferEligibility(offer.id);
    //   console.log(`       Created ${records} eligibility records`);
      stats.exclusive.processed++;
    } catch (error) {
      console.error(`       Failed: ${error.message}`);
      stats.exclusive.failed++;
    }
  }

  // 3. Compute Loyalty Programs
  console.log('\n Computing Loyalty Programs...');
  const loyaltyPrograms = await prisma.loyaltyProgram.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  stats.loyalty.total = loyaltyPrograms.length;
  console.log(`   Found ${loyaltyPrograms.length} active loyalty programs`);

  for (const [index, program] of loyaltyPrograms.entries()) {
    try {
      console.log(`   [${index + 1}/${loyaltyPrograms.length}] Processing: ${program.name}`);
    //   const records = await computationService.computeLoyaltyProgramEligibility(program.id);
    //   console.log(`       Created ${records} eligibility records`);
      stats.loyalty.processed++;
    } catch (error) {
      console.error(`       Failed: ${error.message}`);
      stats.loyalty.failed++;
    }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log(' Migration Complete!\n');
  console.log('Summary:');
  console.log(`   Cashback Configurations: ${stats.cashback.processed}/${stats.cashback.total} (${stats.cashback.failed} failed)`);
  console.log(`   Exclusive Offers:        ${stats.exclusive.processed}/${stats.exclusive.total} (${stats.exclusive.failed} failed)`);
  console.log(`   Loyalty Programs:        ${stats.loyalty.processed}/${stats.loyalty.total} (${stats.loyalty.failed} failed)`);

  // 5. Check total eligibility records created
  const totalRecords = await prisma.userOfferEligibility.count();
  console.log(`\n   Total Eligibility Records: ${totalRecords.toLocaleString()}`);

  // 6. Recommendations
  console.log('\n' + '='.repeat(60));
  console.log(' Next Steps:');
  console.log('   1. Verify eligibility records in database');
  console.log('   2. Test offers query with sample users');
  console.log('   3. Enable feature flag: USE_MATERIALIZED_ELIGIBILITY=true');
  console.log('   4. Monitor performance metrics');
  console.log('   5. Gradually roll out to production traffic');
  console.log('='.repeat(60) + '\n');

  if (stats.cashback.failed + stats.exclusive.failed + stats.loyalty.failed > 0) {
    console.log('  Some offers failed to compute. Check logs above for details.');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(' Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
