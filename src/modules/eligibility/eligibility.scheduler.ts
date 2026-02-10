import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EligibilityQueueService } from './eligibility-queue.service';
import { EligibilityComputationService } from './eligibility-computation.service';
import {
  EligibilityEntityTypeEnum,
  OfferTypeEnum,
  QueueStatusEnum,
} from '@prisma/client';
import { QUEUE_PRIORITY, FEATURE_FLAGS } from '../../common/constants';

@Injectable()
export class EligibilityScheduler {
  private readonly logger = new Logger(EligibilityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: EligibilityQueueService,
    private readonly computationService: EligibilityComputationService,
  ) {}

  
   // Expire offers that have passed their end date
   // Runs every hour
   
  @Cron(CronExpression.EVERY_HOUR)
  async expireOutdatedOffers(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      this.logger.log('Running scheduled task: Expire outdated offers');
      const now = new Date();

      // Deactivate expired eligibility records for exclusive offers
      const expiredExclusive = await this.prisma.userOfferEligibility.updateMany({
        where: {
          offerType: OfferTypeEnum.EXCLUSIVE,
          isActive: true,
          validUntil: {
            lt: now,
          },
        },
        data: {
          isActive: false,
        },
      });

      // Deactivate expired eligibility records for cashback with end dates
      const expiredCashback = await this.prisma.userOfferEligibility.updateMany({
        where: {
          offerType: OfferTypeEnum.CASHBACK,
          isActive: true,
          validUntil: {
            not: null,
            lt: now,
          },
        },
        data: {
          isActive: false,
        },
      });

      this.logger.log(
        `Expired ${expiredExclusive.count + expiredCashback.count} eligibility records`,
      );
    } catch (error) {
      this.logger.error('Error expiring outdated offers', error);
    }
  }

  
   // Update budget status for offers
   // Runs every 15 minutes
   
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateBudgetStatus(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      this.logger.log('Running scheduled task: Update budget status');

      // Find cashback configs that have exhausted budget
      const exhaustedCashback = await this.prisma.cashbackConfiguration.findMany({
        where: {
          isActive: true,
          usedCashbackBudget: {
            gte: this.prisma.cashbackConfiguration.fields.netCashbackBudget,
          },
        },
        select: { id: true },
      });

      for (const config of exhaustedCashback) {
        await this.prisma.userOfferEligibility.updateMany({
          where: {
            offerType: OfferTypeEnum.CASHBACK,
            offerId: config.id,
          },
          data: {
            hasBudgetRemaining: false,
            isActive: false,
          },
        });
      }

      // Find exclusive offers that have exhausted budget
      const exhaustedExclusive = await this.prisma.exclusiveOffer.findMany({
        where: {
          isActive: true,
          usedOfferBudget: {
            gte: this.prisma.exclusiveOffer.fields.netOfferBudget,
          },
        },
        select: { id: true },
      });

      for (const offer of exhaustedExclusive) {
        await this.prisma.userOfferEligibility.updateMany({
          where: {
            offerType: OfferTypeEnum.EXCLUSIVE,
            offerId: offer.id,
          },
          data: {
            hasBudgetRemaining: false,
            isActive: false,
          },
        });
      }

      // Find loyalty programs that have exhausted points budget
      const exhaustedLoyalty = await this.prisma.loyaltyProgram.findMany({
        where: {
          isActive: true,
          pointsIssuedLimit: { not: null },
          pointsUsedInPeriod: {
            gte: this.prisma.loyaltyProgram.fields.pointsIssuedLimit,
          },
        },
        select: { id: true },
      });

      for (const program of exhaustedLoyalty) {
        await this.prisma.userOfferEligibility.updateMany({
          where: {
            offerType: OfferTypeEnum.LOYALTY,
            offerId: program.id,
          },
          data: {
            hasBudgetRemaining: false,
            isActive: false,
          },
        });
      }

      this.logger.log(
        `Updated budget status: ${exhaustedCashback.length} cashback, ${exhaustedExclusive.length} exclusive, ${exhaustedLoyalty.length} loyalty`,
      );
    } catch (error) {
      this.logger.error('Error updating budget status', error);
    }
  }

  
   // Activate newly available offers
   // Runs every 5 minutes
   
  @Cron(CronExpression.EVERY_5_MINUTES)
  async activateNewOffers(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      this.logger.log('Running scheduled task: Activate new offers');
      const now = new Date();

      // Find exclusive offers that just became active
      const newOffers = await this.prisma.exclusiveOffer.findMany({
        where: {
          isActive: true,
          startDate: {
            lte: now,
          },
          endDate: {
            gte: now,
          },
          OR: [
            { eligibilityComputedAt: null },
            {
              eligibilityComputedAt: {
                lt: this.prisma.exclusiveOffer.fields.updatedAt,
              },
            },
          ],
        },
        select: { id: true },
      });

      for (const offer of newOffers) {
        await this.queueService.queueOfferRecomputation(
          EligibilityEntityTypeEnum.EXCLUSIVE_OFFER,
          offer.id,
          'Offer became active',
          QUEUE_PRIORITY.HIGH,
        );
      }

      this.logger.log(`Queued ${newOffers.length} newly active offers for computation`);
    } catch (error) {
      this.logger.error('Error activating new offers', error);
    }
  }

  
   // Process pending queue items
   // Runs every minute
   
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingQueue(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      const processed = await this.queueService.processPendingQueue();
      if (processed > 0) {
        this.logger.log(`Processed ${processed} pending queue items`);
      }
    } catch (error) {
      this.logger.error('Error processing pending queue', error);
    }
  }

  
   // Cleanup old data
   // Runs daily at 2 AM

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldData(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      this.logger.log('Running scheduled task: Cleanup old data');

      // Clean up expired cache entries
      const expiredCache = await this.prisma.cleanupExpiredCache();

      // Clean up old computation logs (keep last 30 days)
      const oldLogs = await this.prisma.cleanupOldLogs();

      // Clean up completed queue items (keep last 7 days)
      const oldQueue = await this.queueService.cleanupOldQueueItems(7);

      // Clean up inactive eligibility records older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const oldEligibility = await this.prisma.userOfferEligibility.deleteMany({
        where: {
          isActive: false,
          updatedAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cleanup completed: ${expiredCache} cache, ${oldLogs} logs, ${oldQueue} queue items, ${oldEligibility.count} old eligibility records`,
      );
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }

  
   // Full recomputation of stale eligibility
   // Runs daily at 3 AM
   
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async recomputeStaleEligibility(): Promise<void> {
    if (!FEATURE_FLAGS.ENABLE_BACKGROUND_JOBS) return;

    try {
      this.logger.log('Running scheduled task: Recompute stale eligibility');

      // Find offers that haven't been computed in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const staleCashback = await this.prisma.cashbackConfiguration.findMany({
        where: {
          isActive: true,
          OR: [
            { eligibilityComputedAt: null },
            { eligibilityComputedAt: { lt: sevenDaysAgo } },
          ],
        },
        select: { id: true },
        take: 100, // Limit to prevent overload
      });

      const staleExclusive = await this.prisma.exclusiveOffer.findMany({
        where: {
          isActive: true,
          OR: [
            { eligibilityComputedAt: null },
            { eligibilityComputedAt: { lt: sevenDaysAgo } },
          ],
        },
        select: { id: true },
        take: 100,
      });

      const staleLoyalty = await this.prisma.loyaltyProgram.findMany({
        where: {
          isActive: true,
          OR: [
            { eligibilityComputedAt: null },
            { eligibilityComputedAt: { lt: sevenDaysAgo } },
          ],
        },
        select: { id: true },
        take: 100,
      });

      // Queue for recomputation
      for (const config of staleCashback) {
        await this.queueService.queueOfferRecomputation(
          EligibilityEntityTypeEnum.CASHBACK_CONFIG,
          config.id,
          'Scheduled recomputation',
          QUEUE_PRIORITY.LOW,
        );
      }

      for (const offer of staleExclusive) {
        await this.queueService.queueOfferRecomputation(
          EligibilityEntityTypeEnum.EXCLUSIVE_OFFER,
          offer.id,
          'Scheduled recomputation',
          QUEUE_PRIORITY.LOW,
        );
      }

      for (const program of staleLoyalty) {
        await this.queueService.queueOfferRecomputation(
          EligibilityEntityTypeEnum.LOYALTY_PROGRAM,
          program.id,
          'Scheduled recomputation',
          QUEUE_PRIORITY.LOW,
        );
      }

      this.logger.log(
        `Queued stale offers for recomputation: ${staleCashback.length} cashback, ${staleExclusive.length} exclusive, ${staleLoyalty.length} loyalty`,
      );
    } catch (error) {
      this.logger.error('Error recomputing stale eligibility', error);
    }
  }
}
