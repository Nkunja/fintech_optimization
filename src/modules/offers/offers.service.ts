import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, OfferTypeEnum } from '@prisma/client';
import {
  CashbackPercentageFilters,
  PERCENTAGE_FILTER_RANGES,
  CACHE_TTL,
  FEATURE_FLAGS,
} from '../../common/constants';
import * as crypto from 'crypto';

export interface OffersQueryArgs {
  userId: string;
  search?: string;
  category?: string;
  percentage?: CashbackPercentageFilters;
  limit?: number;
  offset?: number;
}

export interface OfferResult {
  outlets: any[];
  totalCount: number;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(private readonly prisma: PrismaService) {}

  
  // This function replaces the complex runtime query with a simple lookup
   
  async getOffersForUser(args: OffersQueryArgs): Promise<OfferResult> {
    const { userId, search, category, percentage, limit = 50, offset = 0 } = args;

    // Try to get from cache first
    if (FEATURE_FLAGS.ENABLE_QUERY_CACHE) {
      const cached = await this.getFromCache(args);
      if (cached) {
        this.logger.debug(`Cache hit for user ${userId}`);
        return cached;
      }
    }

    const now = new Date();

    // Build filter for eligibility table
    const eligibilityWhere: Prisma.UserOfferEligibilityWhereInput = {
      userId,
      isActive: true,
      hasBudgetRemaining: true,
    
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      
      ...(category && { merchantCategory: category }),
    
      ...(search && {
        OR: [
          { merchantName: { contains: search, mode: 'insensitive' } },
          { outletName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      
      ...(percentage && this.buildPercentageFilter(percentage)),
    };

    // Get total count
    const totalCount = await this.prisma.userOfferEligibility.count({
      where: eligibilityWhere,
    });

    if (totalCount === 0) {
      const rawCount = await this.prisma.userOfferEligibility.count({
        where: { userId, isActive: true },
      });
      this.logger.warn(
        `getOffersForUser: 0 results for userId="${userId}" (raw eligibility count for user: ${rawCount}). Check category/search/percentage filters or validFrom/validUntil.`,
      );
    }

    // Get distinct outlet IDs with pagination
    const eligibilityRecords = await this.prisma.userOfferEligibility.findMany({
      where: eligibilityWhere,
      select: {
        outletId: true,
        offerType: true,
        offerId: true,
      },
      distinct: ['outletId'],
      orderBy: {
        computedAt: 'desc', // Most recently computed first
      },
      skip: offset,
      take: limit,
    });

    // Get unique outlet IDs
    const outletIds = [...new Set(eligibilityRecords.map((r) => r.outletId))];

    if (outletIds.length === 0) {
      return { outlets: [], totalCount: 0 };
    }

    // Fetch full outlet data with all related offers
    // This is much simpler than the original query
    const outlets = await this.prisma.outlet.findMany({
      where: {
        id: { in: outletIds },
        isActive: true,
      },
      include: {
        Merchant: {
          select: {
            id: true,
            businessName: true,
            category: true,
            status: true,
          },
        },
        CashbackConfigurations: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
            CashbackConfigurationTiers: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
        ExclusiveOffers: {
          where: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    // For each outlet, filter to only include offers user is eligible for
    const filteredOutlets = outlets.map((outlet) => {
      const userEligibleOffers = eligibilityRecords.filter(
        (r) => r.outletId === outlet.id,
      );

      // Get eligible offer IDs by type
      const eligibleCashbackIds = userEligibleOffers
        .filter((r) => r.offerType === OfferTypeEnum.CASHBACK)
        .map((r) => r.offerId);

      const eligibleExclusiveIds = userEligibleOffers
        .filter((r) => r.offerType === OfferTypeEnum.EXCLUSIVE)
        .map((r) => r.offerId);

      return {
        ...outlet,
        CashbackConfigurations: outlet.CashbackConfigurations.filter((c) =>
          eligibleCashbackIds.includes(c.id),
        ),
        ExclusiveOffers: outlet.ExclusiveOffers.filter((e) =>
          eligibleExclusiveIds.includes(e.id),
        ),
      };
    });

    // Filter out outlets with no eligible offers
    const result = {
      outlets: filteredOutlets.filter(
        (o) => o.CashbackConfigurations.length > 0 || o.ExclusiveOffers.length > 0,
      ),
      totalCount,
    };

    // Cache the result
    if (FEATURE_FLAGS.ENABLE_QUERY_CACHE) {
      await this.saveToCache(args, result);
    }

    return result;
  }

  
  // Get loyalty programs for a user
   
  async getLoyaltyProgramsForUser(
    userId: string,
    category?: string,
    search?: string,
  ): Promise<any[]> {
    const now = new Date();

    const eligibilityWhere: Prisma.UserOfferEligibilityWhereInput = {
      userId,
      isActive: true,
      hasBudgetRemaining: true,
      offerType: OfferTypeEnum.LOYALTY,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      ...(category && { merchantCategory: category }),
      ...(search && {
        OR: [
          { merchantName: { contains: search, mode: 'insensitive' } },
          { outletName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const eligibilityRecords = await this.prisma.userOfferEligibility.findMany({
      where: eligibilityWhere,
      select: {
        offerId: true,
      },
      distinct: ['offerId'],
    });

    const programIds = eligibilityRecords.map((r) => r.offerId);

    if (programIds.length === 0) {
      return [];
    }

    const programs = await this.prisma.loyaltyProgram.findMany({
      where: {
        id: { in: programIds },
        isActive: true,
      },
      include: {
        Merchant: true,
        LoyaltyTiers: {
          where: {
            isActive: true,
            deletedAt: null,
          },
        },
        MerchantLoyaltyRewards: {
          where: {
            isActive: true,
          },
        },
      },
    });

    return programs;
  }

  
  // Build percentage filter for cashback offers
   
  private buildPercentageFilter(
    percentage: CashbackPercentageFilters,
  ): Prisma.UserOfferEligibilityWhereInput {
    const range = PERCENTAGE_FILTER_RANGES[percentage];

    const conditions: Prisma.UserOfferEligibilityWhereInput[] = [
      { offerType: OfferTypeEnum.CASHBACK },
    ];

    if (range.min !== undefined) {
      conditions.push({ maxPercentage: { gte: range.min } });
    }

    if (range.max !== undefined) {
      conditions.push({ minPercentage: { lte: range.max } });
    }

    return { AND: conditions };
  }

  
  // Cache management
   
  private generateCacheKey(args: OffersQueryArgs): string {
    const keyData = JSON.stringify({
      userId: args.userId,
      search: args.search,
      category: args.category,
      percentage: args.percentage,
      limit: args.limit,
      offset: args.offset,
    });
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  private async getFromCache(args: OffersQueryArgs): Promise<OfferResult | null> {
    try {
      const cacheKey = this.generateCacheKey(args);
      const cached = await this.prisma.offerListCache.findUnique({
        where: { cacheKey },
      });

      if (!cached) {
        return null;
      }

      if (cached.expiresAt < new Date()) {
        // Delete expired cache
        await this.prisma.offerListCache.delete({ where: { cacheKey } });
        return null;
      }

      return cached.data as unknown as OfferResult;
    } catch (error) {
      this.logger.error('Error reading from cache', error);
      return null;
    }
  }

  private async saveToCache(args: OffersQueryArgs, data: OfferResult): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(args);
      const expiresAt = new Date(Date.now() + CACHE_TTL.OFFER_LIST * 1000);

      await this.prisma.offerListCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          data: data as any,
          expiresAt,
        },
        update: {
          data: data as any,
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.error('Error saving to cache', error);
    }
  }

  
   // Invalidate cache for a user
   
  async invalidateUserCache(userId: string): Promise<void> {
    // This will delete all cache entries that contain the userId in their key
    await this.prisma.offerListCache.deleteMany({
      where: {
        cacheKey: {
          contains: userId,
        },
      },
    });
  }
}
