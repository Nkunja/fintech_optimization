import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerTypeEnum,
  OfferTypeEnum,
  Prisma,
  ReviewStatusEnum,
  MerchantStatusEnum,
} from '@prisma/client';
import {
  SPECIAL_CUSTOMER_TYPES,
  getEligibleCustomerTypes,
  BATCH_LIMITS,
} from '../../common/constants';

@Injectable()
export class EligibilityComputationService {
  private readonly logger = new Logger(EligibilityComputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  
   // Compute eligibility for a specific cashback configuration
   // This is the core method that replaces the complex runtime query
   
  async computeCashbackEligibility(cashbackConfigId: string): Promise<number> {
    const startTime = Date.now();
    let recordsCreated = 0;

    try {
      // Fetch the cashback configuration with all necessary relations
      const config = await this.prisma.cashbackConfiguration.findUnique({
        where: { id: cashbackConfigId },
        include: {
          Merchant: true,
          Outlets: {
            where: {
              isActive: true,
              Review: { status: ReviewStatusEnum.Approved },
              PaybillOrTills: {
                some: {
                  isActive: true,
                  deletedAt: null,
                  Review: { status: ReviewStatusEnum.Approved },
                },
              },
            },
            include: {
              Review: true,
            },
          },
          Review: true,
          CashbackConfigurationTiers: {
            where: {
              isActive: true,
              deletedAt: null,
              Review: { status: ReviewStatusEnum.Approved },
            },
            include: {
              Review: true,
            },
          },
        },
      });

      if (!config) {
        this.logger.warn(`Cashback config ${cashbackConfigId} not found`);
        return 0;
      }

      // Validate config is eligible for computation
      if (
        !this.isCashbackConfigEligible(config)
      ) {
        this.logger.debug(`Cashback config ${cashbackConfigId} not eligible, skipping`);
        await this.invalidateCashbackEligibility(cashbackConfigId);
        return 0;
      }

      // Delete existing eligibility records for this offer
      await this.prisma.userOfferEligibility.deleteMany({
        where: {
          offerType: OfferTypeEnum.CASHBACK,
          offerId: cashbackConfigId,
        },
      });

      // Get eligible users based on customer types
      const eligibleUsers = await this.getEligibleUsersForOffer(
        config.merchantId,
        config.eligibleCustomerTypes,
      );

      // Calculate percentage range for filtering
      const percentageRange = this.calculatePercentageRange(
        config.CashbackConfigurationTiers,
      );

      // Create eligibility records in batches
      for (let i = 0; i < eligibleUsers.length; i += BATCH_LIMITS.USERS_PER_OFFER) {
        const batch = eligibleUsers.slice(i, i + BATCH_LIMITS.USERS_PER_OFFER);

        const eligibilityRecords = batch.flatMap((userId) =>
          config.Outlets.map((outlet) => ({
            userId,
            outletId: outlet.id,
            offerType: OfferTypeEnum.CASHBACK,
            offerId: config.id,
            merchantId: config.merchantId,
            validFrom: config.startDate || new Date(),
            validUntil: config.endDate,
            isActive: config.isActive,
            merchantCategory: config.Merchant.category,
            merchantName: config.Merchant.businessName,
            outletName: outlet.name,
            minPercentage: percentageRange.min,
            maxPercentage: percentageRange.max,
            hasBudgetRemaining: this.hasBudgetRemaining(
              config.usedCashbackBudget,
              config.netCashbackBudget,
            ),
            computedAt: new Date(),
          })),
        );

        if (eligibilityRecords.length > 0) {
          await this.prisma.userOfferEligibility.createMany({
            data: eligibilityRecords,
            skipDuplicates: true,
          });
          recordsCreated += eligibilityRecords.length;
        }
      }

      // Update the config with computation timestamp
      await this.prisma.cashbackConfiguration.update({
        where: { id: cashbackConfigId },
        data: { eligibilityComputedAt: new Date() },
      });

      const duration = Date.now() - startTime;
      await this.logComputation('CASHBACK_CONFIG', cashbackConfigId, recordsCreated, duration);

      this.logger.log(
        `Computed cashback eligibility for ${cashbackConfigId}: ${recordsCreated} records in ${duration}ms`,
      );

      return recordsCreated;
    } catch (error) {
      this.logger.error(
        `Error computing cashback eligibility for ${cashbackConfigId}`,
        error,
      );
      throw error;
    }
  }

  
   // Compute eligibility for a specific exclusive offer
   
  async computeExclusiveOfferEligibility(offerId: string): Promise<number> {
    const startTime = Date.now();
    let recordsCreated = 0;

    try {
      const offer = await this.prisma.exclusiveOffer.findUnique({
        where: { id: offerId },
        include: {
          Merchant: true,
          Outlets: {
            where: {
              isActive: true,
              Review: { status: ReviewStatusEnum.Approved },
              PaybillOrTills: {
                some: {
                  isActive: true,
                  deletedAt: null,
                  Review: { status: ReviewStatusEnum.Approved },
                },
              },
            },
          },
          Review: true,
        },
      });

      if (!offer) {
        this.logger.warn(`Exclusive offer ${offerId} not found`);
        return 0;
      }

      if (!this.isExclusiveOfferEligible(offer)) {
        this.logger.debug(`Exclusive offer ${offerId} not eligible, skipping`);
        await this.invalidateExclusiveOfferEligibility(offerId);
        return 0;
      }

      // Delete existing eligibility records
      await this.prisma.userOfferEligibility.deleteMany({
        where: {
          offerType: OfferTypeEnum.EXCLUSIVE,
          offerId: offerId,
        },
      });

      // Get eligible users
      const eligibleUsers = await this.getEligibleUsersForOffer(
        offer.merchantId || '',
        offer.eligibleCustomerTypes,
      );

      // Create eligibility records in batches
      for (let i = 0; i < eligibleUsers.length; i += BATCH_LIMITS.USERS_PER_OFFER) {
        const batch = eligibleUsers.slice(i, i + BATCH_LIMITS.USERS_PER_OFFER);

        const eligibilityRecords = batch.flatMap((userId) =>
          offer.Outlets.map((outlet) => ({
            userId,
            outletId: outlet.id,
            offerType: OfferTypeEnum.EXCLUSIVE,
            offerId: offer.id,
            merchantId: offer.merchantId || '',
            validFrom: offer.startDate,
            validUntil: offer.endDate,
            isActive: offer.isActive,
            merchantCategory: offer.Merchant?.category,
            merchantName: offer.Merchant?.businessName,
            outletName: outlet.name,
            hasBudgetRemaining: this.hasBudgetRemaining(
              offer.usedOfferBudget,
              offer.netOfferBudget,
            ),
            computedAt: new Date(),
          })),
        );

        if (eligibilityRecords.length > 0) {
          await this.prisma.userOfferEligibility.createMany({
            data: eligibilityRecords,
            skipDuplicates: true,
          });
          recordsCreated += eligibilityRecords.length;
        }
      }

      await this.prisma.exclusiveOffer.update({
        where: { id: offerId },
        data: { eligibilityComputedAt: new Date() },
      });

      const duration = Date.now() - startTime;
      await this.logComputation('EXCLUSIVE_OFFER', offerId, recordsCreated, duration);

      this.logger.log(
        `Computed exclusive offer eligibility for ${offerId}: ${recordsCreated} records in ${duration}ms`,
      );

      return recordsCreated;
    } catch (error) {
      this.logger.error(`Error computing exclusive offer eligibility for ${offerId}`, error);
      throw error;
    }
  }

  
   // Compute eligibility for a loyalty program
   
  async computeLoyaltyProgramEligibility(programId: string): Promise<number> {
    const startTime = Date.now();
    let recordsCreated = 0;

    try {
      const program = await this.prisma.loyaltyProgram.findUnique({
        where: { id: programId },
        include: {
          Merchant: {
            include: {
              Outlets: {
                where: {
                  isActive: true,
                  Review: { status: ReviewStatusEnum.Approved },
                  PaybillOrTills: {
                    some: {
                      isActive: true,
                      deletedAt: null,
                      Review: { status: ReviewStatusEnum.Approved },
                    },
                  },
                },
              },
            },
          },
          Review: true,
          LoyaltyTiers: {
            where: {
              isActive: true,
              deletedAt: null,
              Review: { status: ReviewStatusEnum.Approved },
            },
          },
          MerchantLoyaltyRewards: {
            where: {
              isActive: true,
              Review: { status: ReviewStatusEnum.Approved },
            },
          },
        },
      });

      if (!program) {
        this.logger.warn(`Loyalty program ${programId} not found`);
        return 0;
      }

      if (!this.isLoyaltyProgramEligible(program)) {
        this.logger.debug(`Loyalty program ${programId} not eligible, skipping`);
        await this.invalidateLoyaltyProgramEligibility(programId);
        return 0;
      }

      // Delete existing eligibility records
      await this.prisma.userOfferEligibility.deleteMany({
        where: {
          offerType: OfferTypeEnum.LOYALTY,
          offerId: programId,
        },
      });

      // For loyalty programs, we need to handle tier-based eligibility
      const eligibleUsersByTier = await this.getEligibleUsersForLoyaltyProgram(
        program.merchantId || '',
        program.LoyaltyTiers,
      );

      // Create eligibility records
      for (let i = 0; i < eligibleUsersByTier.length; i += BATCH_LIMITS.USERS_PER_OFFER) {
        const batch = eligibleUsersByTier.slice(i, i + BATCH_LIMITS.USERS_PER_OFFER);

        const eligibilityRecords = batch.flatMap((userId) =>
          program.Merchant!.Outlets.map((outlet) => ({
            userId,
            outletId: outlet.id,
            offerType: OfferTypeEnum.LOYALTY,
            offerId: program.id,
            merchantId: program.merchantId || '',
            validFrom: new Date(),
            validUntil: null, // Loyalty programs don't have end dates typically
            isActive: program.isActive,
            merchantCategory: program.Merchant?.category,
            merchantName: program.Merchant?.businessName,
            outletName: outlet.name,
            hasBudgetRemaining: this.hasPointsBudgetRemaining(
              program.pointsUsedInPeriod,
              program.pointsIssuedLimit,
            ),
            computedAt: new Date(),
          })),
        );

        if (eligibilityRecords.length > 0) {
          await this.prisma.userOfferEligibility.createMany({
            data: eligibilityRecords,
            skipDuplicates: true,
          });
          recordsCreated += eligibilityRecords.length;
        }
      }

      await this.prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { eligibilityComputedAt: new Date() },
      });

      const duration = Date.now() - startTime;
      await this.logComputation('LOYALTY_PROGRAM', programId, recordsCreated, duration);

      this.logger.log(
        `Computed loyalty program eligibility for ${programId}: ${recordsCreated} records in ${duration}ms`,
      );

      return recordsCreated;
    } catch (error) {
      this.logger.error(`Error computing loyalty program eligibility for ${programId}`, error);
      throw error;
    }
  }

  
    // Get eligible users for an offer based on customer types
   
  private async getEligibleUsersForOffer(
    merchantId: string,
    eligibleCustomerTypes: string[],
  ): Promise<string[]> {
    // Handle "All" customer types
    if (eligibleCustomerTypes.includes(SPECIAL_CUSTOMER_TYPES.ALL)) {
      // Get all users who have any customer type record
      const allUsers = await this.prisma.customerType.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      return allUsers.map((u) => u.userId);
    }

    const userIds = new Set<string>();

    // Handle "NonCustomer" - users who don't have a relationship with this merchant
    if (eligibleCustomerTypes.includes(SPECIAL_CUSTOMER_TYPES.NON_CUSTOMER)) {
      const allUsers = await this.prisma.customerType.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });

      const merchantCustomers = await this.prisma.customerType.findMany({
        where: { merchantId },
        select: { userId: true },
      });

      const merchantCustomerIds = new Set(merchantCustomers.map((c) => c.userId));
      allUsers.forEach((user) => {
        if (!merchantCustomerIds.has(user.userId)) {
          userIds.add(user.userId);
        }
      });
    }

    // Handle specific customer types
    const specificTypes = eligibleCustomerTypes.filter(
      (type) =>
        type !== SPECIAL_CUSTOMER_TYPES.ALL &&
        type !== SPECIAL_CUSTOMER_TYPES.NON_CUSTOMER,
    );

    if (specificTypes.length > 0) {
      const customers = await this.prisma.customerType.findMany({
        where: {
          merchantId,
          type: {
            in: specificTypes as CustomerTypeEnum[],
          },
        },
        select: { userId: true },
      });

      customers.forEach((customer) => userIds.add(customer.userId));
    }

    return Array.from(userIds);
  }

  
   // Get eligible users for loyalty program based on tier requirements
   
  private async getEligibleUsersForLoyaltyProgram(
    merchantId: string,
    tiers: Array<{ minCustomerType: CustomerTypeEnum }>,
  ): Promise<string[]> {
    if (tiers.length === 0) {
      return [];
    }

    // Find the lowest tier requirement
    const lowestTier = tiers.reduce((min, tier) =>
      getEligibleCustomerTypes(tier.minCustomerType).length >
      getEligibleCustomerTypes(min.minCustomerType).length
        ? tier
        : min,
    );

    // Get all customer types that meet or exceed the lowest tier
    const eligibleTypes = getEligibleCustomerTypes(lowestTier.minCustomerType);

    const customers = await this.prisma.customerType.findMany({
      where: {
        merchantId,
        type: {
          in: eligibleTypes,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    return customers.map((c) => c.userId);
  }

  
   // Invalidate eligibility records when an offer becomes ineligible
   
  private async invalidateCashbackEligibility(configId: string): Promise<void> {
    await this.prisma.userOfferEligibility.updateMany({
      where: {
        offerType: OfferTypeEnum.CASHBACK,
        offerId: configId,
      },
      data: {
        isActive: false,
      },
    });
  }

  private async invalidateExclusiveOfferEligibility(offerId: string): Promise<void> {
    await this.prisma.userOfferEligibility.updateMany({
      where: {
        offerType: OfferTypeEnum.EXCLUSIVE,
        offerId: offerId,
      },
      data: {
        isActive: false,
      },
    });
  }

  private async invalidateLoyaltyProgramEligibility(programId: string): Promise<void> {
    await this.prisma.userOfferEligibility.updateMany({
      where: {
        offerType: OfferTypeEnum.LOYALTY,
        offerId: programId,
      },
      data: {
        isActive: false,
      },
    });
  }

  
   // Validation helpers
   
  private isCashbackConfigEligible(config: any): boolean {
    return (
      config.isActive &&
      !config.deletedAt &&
      config.Review?.status === ReviewStatusEnum.Approved &&
      config.Merchant?.status === MerchantStatusEnum.Active &&
      config.CashbackConfigurationTiers.length > 0 &&
      this.hasBudgetRemaining(config.usedCashbackBudget, config.netCashbackBudget)
    );
  }

  private isExclusiveOfferEligible(offer: any): boolean {
    const now = new Date();
    return (
      offer.isActive &&
      !offer.deletedAt &&
      offer.Review?.status === ReviewStatusEnum.Approved &&
      offer.Merchant?.status === MerchantStatusEnum.Active &&
      offer.startDate <= now &&
      offer.endDate >= now &&
      this.hasBudgetRemaining(offer.usedOfferBudget, offer.netOfferBudget)
    );
  }

  private isLoyaltyProgramEligible(program: any): boolean {
    return (
      program.isActive &&
      program.Review?.status === ReviewStatusEnum.Approved &&
      program.Merchant?.status === MerchantStatusEnum.Active &&
      program.LoyaltyTiers.length > 0 &&
      program.MerchantLoyaltyRewards.length > 0 &&
      this.hasPointsBudgetRemaining(program.pointsUsedInPeriod, program.pointsIssuedLimit)
    );
  }

  private hasBudgetRemaining(used: any, total: any): boolean {
    return Number(used) < Number(total);
  }

  private hasPointsBudgetRemaining(used: any, limit: any): boolean {
    if (!limit) return true; // No limit set
    return Number(used) < Number(limit);
  }

  private calculatePercentageRange(tiers: any[]): { min: any; max: any } {
    if (tiers.length === 0) {
      return { min: null, max: null };
    }

    const percentages = tiers.map((t) => Number(t.cashbackPercentage));
    return {
      min: Math.min(...percentages),
      max: Math.max(...percentages),
    };
  }

  
   // Log computation for monitoring
   
  private async logComputation(
    entityType: string,
    entityId: string,
    recordsAffected: number,
    durationMs: number,
  ): Promise<void> {
    try {
      await this.prisma.eligibilityComputationLog.create({
        data: {
          entityType,
          entityId,
          operation: 'COMPUTE',
          recordsAffected,
          durationMs,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log computation', error);
    }
  }
}
