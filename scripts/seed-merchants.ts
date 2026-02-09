#!/usr/bin/env ts-node

/**
 * Seed Merchants Script
 *
 * Creates active merchants (and one outlet per merchant) so you can run
 * load-users and eligibility flows. Safe to run multiple times (upserts by name).
 *
 * Usage:
 *   npm run seed-merchants
 *   npx ts-node scripts/seed-merchants.ts --file scripts/data/merchants.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MerchantEntry {
  businessName: string;
  category: string;
  description?: string;
}

function parseArgs(): { file?: string } {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) return { file: args[i + 1] };
  }
  return {};
}

async function main() {
  const { file } = parseArgs();

  let entries: MerchantEntry[] = [];
  const defaultPath = path.join(process.cwd(), 'scripts/data/merchants.json');

  if (file) {
    const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    entries = Array.isArray(raw) ? raw : [raw];
  } else if (fs.existsSync(defaultPath)) {
    const raw = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
    entries = Array.isArray(raw) ? raw : [raw];
  } else {
    entries = [
      { businessName: 'Acme Coffee', category: 'Food & Beverage', description: 'Coffee and pastries' },
      { businessName: 'Tech Gadgets Ltd', category: 'Electronics', description: 'Phones and accessories' },
      { businessName: 'Green Grocers', category: 'Retail', description: 'Fresh produce' },
    ];
  }

  console.log(`Seeding ${entries.length} merchant(s)...`);

  let created = 0;
  for (const entry of entries) {
    const existing = await prisma.merchant.findFirst({
      where: { businessName: entry.businessName },
    });

    if (existing) {
      if (existing.status !== 'Active') {
        await prisma.merchant.update({
          where: { id: existing.id },
          data: { status: 'Active' },
        });
        console.log(`  Activated: ${entry.businessName}`);
      } else {
        console.log(`  Exists:   ${entry.businessName}`);
      }
      created++;
      continue;
    }

    const merchant = await prisma.merchant.create({
      data: {
        businessName: entry.businessName,
        category: entry.category,
        description: entry.description ?? null,
        status: 'Active',
      },
    });

    await prisma.outlet.create({
      data: {
        name: `${entry.businessName} - Main`,
        description: `Main outlet for ${entry.businessName}`,
        merchantId: merchant.id,
      },
    });

    console.log(`  Created:  ${entry.businessName} (+ outlet)`);
    created++;
  }

  console.log(`\nDone. ${created} merchant(s) ready. Run: npm run load-users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
