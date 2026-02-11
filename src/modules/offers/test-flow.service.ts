import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_USER_IDS } from '../../common/constants';

export interface MerchantInfo {
  id: string;
  businessName: string;
  category: string;
  outletId?: string;
}

export interface EligibleOfferEntry {
  offerType: string;
  offerId: string;
  merchantName: string;
  merchantCategory: string | null;
  outletName: string;
  hasBudgetRemaining: boolean;
}

export interface EligibilitySummary {
  userId: string;
  totalEligible: number;
  offers: EligibleOfferEntry[];
}

export interface CreateTestOffersResult {
  success: boolean;
  message: string;
  merchantId: string;
  merchantName: string;
  cashbackId: string;
  exclusiveId: string;
  loyaltyId: string;
  eligibilityRecordsCreated: number;
}

@Injectable()
export class TestFlowService {
  constructor(private readonly prisma: PrismaService) {}

  getTestUserIds(): string[] {
    return [...TEST_USER_IDS];
  }

  async getMerchants(activeOnly = true): Promise<MerchantInfo[]> {
    const merchants = await this.prisma.merchant.findMany({
      where: activeOnly ? { status: 'Active' } : undefined,
      include: { Outlets: { where: { isActive: true }, take: 1 } },
      orderBy: { businessName: 'asc' },
    });
    return merchants.map((m) => ({
      id: m.id,
      businessName: m.businessName,
      category: m.category,
      outletId: m.Outlets[0]?.id,
    }));
  }

  async getEligibilityForUser(userId: string): Promise<EligibilitySummary> {
    const now = new Date();
    const records = await this.prisma.userOfferEligibility.findMany({
      where: {
        userId,
        isActive: true,
        hasBudgetRemaining: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: [{ merchantName: 'asc' }, { offerType: 'asc' }],
    });
    const offers: EligibleOfferEntry[] = records.map((r) => ({
      offerType: r.offerType,
      offerId: r.offerId,
      merchantName: r.merchantName ?? '',
      merchantCategory: r.merchantCategory,
      outletName: r.outletName ?? '',
      hasBudgetRemaining: r.hasBudgetRemaining,
    }));
    return { userId, totalEligible: offers.length, offers };
  }

  // Eligibility matrix: all test users and their eligible offer count (for quick view in GraphQL). */
  async getEligibilityMatrix(): Promise<{ userId: string; eligibleCount: number }[]> {
    const now = new Date();
    const result: { userId: string; eligibleCount: number }[] = [];
    for (const userId of TEST_USER_IDS) {
      const count = await this.prisma.userOfferEligibility.count({
        where: {
          userId,
          isActive: true,
          hasBudgetRemaining: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
      });
      result.push({ userId, eligibleCount: count });
    }
    return result;
  }

  async createTestMerchant(businessName: string, category: string): Promise<MerchantInfo> {
    const existing = await this.prisma.merchant.findFirst({
      where: { businessName },
    });
    if (existing) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { merchantId: existing.id },
      });
      return {
        id: existing.id,
        businessName: existing.businessName,
        category: existing.category,
        outletId: outlet?.id,
      };
    }
    const merchant = await this.prisma.merchant.create({
      data: {
        businessName,
        category,
        status: 'Active',
      },
    });
    const outlet = await this.prisma.outlet.create({
      data: {
        name: `${businessName} - Main`,
        description: `Main outlet for ${businessName}`,
        merchantId: merchant.id,
      },
    });
    return {
      id: merchant.id,
      businessName: merchant.businessName,
      category: merchant.category,
      outletId: outlet.id,
    };
  }

  async createTestOffers(merchantId: string): Promise<CreateTestOffersResult> {
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      include: { Outlets: { where: { isActive: true }, take: 1 } },
    });
    const outlet = merchant.Outlets[0];
    if (!outlet) {
      throw new Error(`Merchant ${merchant.businessName} has no active outlet. Create an outlet first.`);
    }

    const existingCashback = await this.prisma.cashbackConfiguration.findFirst({
      where: { merchantId },
    });
    if (existingCashback) {
      const [exclusive, loyalty] = await Promise.all([
        this.prisma.exclusiveOffer.findFirst({ where: { merchantId } }),
        this.prisma.loyaltyProgram.findFirst({ where: { merchantId } }),
      ]);
      const count = await this.prisma.userOfferEligibility.count({
        where: { merchantId },
      });
      return {
        success: true,
        message: 'Merchant already has offers; no new records created.',
        merchantId,
        merchantName: merchant.businessName,
        cashbackId: existingCashback.id,
        exclusiveId: exclusive?.id ?? '',
        loyaltyId: loyalty?.id ?? '',
        eligibilityRecordsCreated: count,
      };
    }

    const cashback = await this.prisma.cashbackConfiguration.create({
      data: {
        name: `${merchant.businessName} Cashback`,
        description: `5–10% cashback at ${merchant.businessName}`,
        merchantId: merchant.id,
        netCashbackBudget: 5000,
        usedCashbackBudget: 0,
        eligibleCustomerTypes: ['New', 'Regular', 'Vip', 'Occasional'],
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        Outlets: { connect: [{ id: outlet.id }] },
        CashbackConfigurationTiers: {
          create: [
            { cashbackPercentage: 5, minTransactionAmount: 0, maxTransactionAmount: 99.99 },
            { cashbackPercentage: 10, minTransactionAmount: 100 },
          ],
        },
      },
    });

    const exclusive = await this.prisma.exclusiveOffer.create({
      data: {
        name: `Welcome offer – ${merchant.businessName}`,
        description: `First purchase discount at ${merchant.businessName}`,
        merchantId: merchant.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        netOfferBudget: 2000,
        usedOfferBudget: 0,
        eligibleCustomerTypes: ['New', 'Occasional'],
        Outlets: { connect: [{ id: outlet.id }] },
      },
    });

    const loyalty = await this.prisma.loyaltyProgram.create({
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

    let eligibilityCreated = 0;
    for (const userId of TEST_USER_IDS) {
      const data = [
        {
          userId,
          outletId: outlet.id,
          offerType: 'CASHBACK' as const,
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
          outletId: outlet.id,
          offerType: 'EXCLUSIVE' as const,
          offerId: exclusive.id,
          merchantId: merchant.id,
          merchantCategory: merchant.category,
          merchantName: merchant.businessName,
          outletName: outlet.name,
          hasBudgetRemaining: true,
        },
        {
          userId,
          outletId: outlet.id,
          offerType: 'LOYALTY' as const,
          offerId: loyalty.id,
          merchantId: merchant.id,
          merchantCategory: merchant.category,
          merchantName: merchant.businessName,
          outletName: outlet.name,
          hasBudgetRemaining: true,
        },
      ];
      const r = await this.prisma.userOfferEligibility.createMany({
        data,
        skipDuplicates: true,
      });
      eligibilityCreated += r.count;
    }

    return {
      success: true,
      message: `Created cashback, exclusive, and loyalty offers for ${merchant.businessName}. All test users are now eligible.`,
      merchantId,
      merchantName: merchant.businessName,
      cashbackId: cashback.id,
      exclusiveId: exclusive.id,
      loyaltyId: loyalty.id,
      eligibilityRecordsCreated: eligibilityCreated,
    };
  }
}
