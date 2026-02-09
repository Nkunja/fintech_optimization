#!/usr/bin/env ts-node

/**
 * Load Users Script
 *
 * Creates CustomerType records so users are linked to merchants. This allows
 * eligibility computation to include these users in UserOfferEligibility.
 * Run after you have merchants in the DB; run the eligibility migration after this.
 *
 * Usage:
 *   npx ts-node scripts/load-users.ts
 *   npx ts-node scripts/load-users.ts --file scripts/data/users.json
 *   npx ts-node scripts/load-users.ts --count 10
 *
 * Options:
 *   --file <path>   JSON file: array of { "userId": string, "customerType"?: "Regular"|"Vip"|... }
 *   --count <n>     Generate n test users (user-dev-001, ...) and assign to random merchants
 */

import { PrismaClient, CustomerTypeEnum } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CUSTOMER_TYPES: CustomerTypeEnum[] = [
  'NonCustomer',
  'New',
  'Infrequent',
  'Occasional',
  'Regular',
  'Vip',
];

interface UserEntry {
  userId: string;
  customerType?: string;
}

function parseArgs(): { file?: string; count?: number } {
  const args = process.argv.slice(2);
  const out: { file?: string; count?: number } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      out.file = args[i + 1];
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      out.count = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return out;
}

async function main() {
  const { file, count } = parseArgs();

  const merchants = await prisma.merchant.findMany({
    where: { status: 'Active' },
    select: { id: true },
    take: 100,
  });

  if (merchants.length === 0) {
    console.error('No active merchants found. Create merchants first, then run this script.');
    process.exit(1);
  }

  let entries: UserEntry[] = [];

  if (file) {
    const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    entries = Array.isArray(raw) ? raw : [raw];
    console.log(`Loaded ${entries.length} user(s) from ${filePath}`);
  } else if (count && count > 0) {
    entries = Array.from({ length: count }, (_, i) => ({
      userId: `user-dev-${String(i + 1).padStart(3, '0')}`,
      customerType: CUSTOMER_TYPES[Math.min(i % CUSTOMER_TYPES.length, 5)],
    }));
    console.log(`Generated ${count} test user(s).`);
  } else {
    const defaultPath = path.join(process.cwd(), 'scripts/data/users.json');
    if (fs.existsSync(defaultPath)) {
      const raw = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
      entries = Array.isArray(raw) ? raw : [raw];
      console.log(`Loaded ${entries.length} user(s) from scripts/data/users.json`);
    } else {
      console.log('No --file or --count provided. Creating 5 default test users.');
      entries = [
        { userId: 'user-dev-001', customerType: 'Regular' },
        { userId: 'user-dev-002', customerType: 'Vip' },
        { userId: 'user-dev-003', customerType: 'Occasional' },
        { userId: 'user-dev-004', customerType: 'New' },
        { userId: 'user-dev-005', customerType: 'Infrequent' },
      ];
    }
  }

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const type = (entry.customerType ?? 'New') as CustomerTypeEnum;
    const customerType = CUSTOMER_TYPES.includes(type) ? type : 'New';

    for (const merchant of merchants) {
      try {
        await prisma.customerType.upsert({
          where: {
            userId_merchantId: { userId: entry.userId, merchantId: merchant.id },
          },
          create: {
            userId: entry.userId,
            merchantId: merchant.id,
            type: customerType,
          },
          update: { type: customerType },
        });
        created++;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2002') skipped++;
        else throw e;
      }
    }
  }

  console.log(`\nDone. CustomerType records created/updated: ${created} (skipped duplicates: ${skipped}).`);
  console.log('Next: run the eligibility migration so these users get UserOfferEligibility records.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
