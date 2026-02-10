import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import {
  EligibilityEntityTypeEnum,
  QueueStatusEnum,
} from '@prisma/client';
import { QUEUE_PRIORITY, BATCH_LIMITS } from '../../common/constants';

export interface EligibilityJob {
  entityType: EligibilityEntityTypeEnum;
  entityId: string;
  reason: string;
  priority: number;
}

@Injectable()
export class EligibilityQueueService {
  private readonly logger = new Logger(EligibilityQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('eligibility-computation') private eligibilityQueue: Queue,
  ) {}

  
   // Queue an offer for eligibility recomputation
   
  async queueOfferRecomputation(
    entityType: EligibilityEntityTypeEnum,
    entityId: string,
    reason: string,
    priority: number = QUEUE_PRIORITY.MEDIUM,
  ): Promise<void> {
    // Check if already queued
    const existing = await this.prisma.eligibilityComputationQueue.findFirst({
      where: {
        entityType,
        entityId,
        status: {
          in: [QueueStatusEnum.Pending, QueueStatusEnum.Processing],
        },
      },
    });

    if (existing) {
      // Update priority if higher
      if (priority > existing.priority) {
        await this.prisma.eligibilityComputationQueue.update({
          where: { id: existing.id },
          data: { priority, reason },
        });
      }
      return;
    }

    // Create queue entry
    await this.prisma.eligibilityComputationQueue.create({
      data: {
        entityType,
        entityId,
        reason,
        priority,
        status: QueueStatusEnum.Pending,
      },
    });

    // Add to Bull queue for processing
    await this.eligibilityQueue.add(
      'compute-eligibility',
      { entityType, entityId, reason, priority },
      { priority },
    );

    this.logger.log(`Queued ${entityType} ${entityId} for recomputation: ${reason}`);
  }

  
   // Queue all offers for a merchant when merchant data changes
   
  async queueMerchantOffersRecomputation(
    merchantId: string,
    reason: string,
    priority: number = QUEUE_PRIORITY.MEDIUM,
  ): Promise<void> {
    // Queue all cashback configurations
    const cashbackConfigs = await this.prisma.cashbackConfiguration.findMany({
      where: { merchantId },
      select: { id: true },
    });

    for (const config of cashbackConfigs) {
      await this.queueOfferRecomputation(
        EligibilityEntityTypeEnum.CASHBACK_CONFIG,
        config.id,
        reason,
        priority,
      );
    }

    // Queue all exclusive offers
    const exclusiveOffers = await this.prisma.exclusiveOffer.findMany({
      where: { merchantId },
      select: { id: true },
    });

    for (const offer of exclusiveOffers) {
      await this.queueOfferRecomputation(
        EligibilityEntityTypeEnum.EXCLUSIVE_OFFER,
        offer.id,
        reason,
        priority,
      );
    }

    // Queue loyalty program
    const loyaltyProgram = await this.prisma.loyaltyProgram.findUnique({
      where: { merchantId },
      select: { id: true },
    });

    if (loyaltyProgram) {
      await this.queueOfferRecomputation(
        EligibilityEntityTypeEnum.LOYALTY_PROGRAM,
        loyaltyProgram.id,
        reason,
        priority,
      );
    }
  }

  
   // Queue recomputation when a user's customer type changes
   
  async queueUserEligibilityRecomputation(
    userId: string,
    merchantId: string,
    reason: string,
  ): Promise<void> {
    // Invalidate existing eligibility for this user and merchant
    await this.prisma.userOfferEligibility.updateMany({
      where: {
        userId,
        merchantId,
      },
      data: {
        isActive: false,
      },
    });

    // Queue merchant offers for recomputation
    await this.queueMerchantOffersRecomputation(
      merchantId,
      `${reason} (user: ${userId})`,
      QUEUE_PRIORITY.HIGH,
    );
  }

  
    // Process pending queue items (called by worker)
   
  async processPendingQueue(limit: number = BATCH_LIMITS.QUEUE_PROCESSING): Promise<number> {
    const pendingItems = await this.prisma.eligibilityComputationQueue.findMany({
      where: {
        status: QueueStatusEnum.Pending,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    let processed = 0;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await this.prisma.eligibilityComputationQueue.update({
          where: { id: item.id },
          data: {
            status: QueueStatusEnum.Processing,
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        // Add to Bull queue
        await this.eligibilityQueue.add(
          'compute-eligibility',
          {
            entityType: item.entityType,
            entityId: item.entityId,
            reason: item.reason,
            priority: item.priority,
          },
          { priority: item.priority },
        );

        processed++;
      } catch (error) {
        this.logger.error(`Failed to process queue item ${item.id}`, error);

        // Mark as failed if too many attempts
        if (item.attempts >= 3) {
          await this.prisma.eligibilityComputationQueue.update({
            where: { id: item.id },
            data: {
              status: QueueStatusEnum.Failed,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        } else {
          // Reset to pending for retry
          await this.prisma.eligibilityComputationQueue.update({
            where: { id: item.id },
            data: {
              status: QueueStatusEnum.Pending,
            },
          });
        }
      }
    }

    return processed;
  }

  
   // Mark queue item as completed
   
  async markCompleted(entityType: EligibilityEntityTypeEnum, entityId: string): Promise<void> {
    await this.prisma.eligibilityComputationQueue.updateMany({
      where: {
        entityType,
        entityId,
        status: QueueStatusEnum.Processing,
      },
      data: {
        status: QueueStatusEnum.Completed,
        completedAt: new Date(),
      },
    });
  }

  
  // Mark queue item as failed
   
  async markFailed(
    entityType: EligibilityEntityTypeEnum,
    entityId: string,
    error: string,
  ): Promise<void> {
    await this.prisma.eligibilityComputationQueue.updateMany({
      where: {
        entityType,
        entityId,
        status: QueueStatusEnum.Processing,
      },
      data: {
        status: QueueStatusEnum.Failed,
        error,
      },
    });
  }

  
   // Cleanup old completed queue items
   
  async cleanupOldQueueItems(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.eligibilityComputationQueue.deleteMany({
      where: {
        status: QueueStatusEnum.Completed,
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
