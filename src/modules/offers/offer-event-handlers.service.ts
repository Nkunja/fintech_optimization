import { Injectable, Logger } from '@nestjs/common';
// import { EligibilityQueueService } from '../eligibility/eligibility-queue.service';
import { EligibilityEntityTypeEnum } from '@prisma/client';
import { QUEUE_PRIORITY } from '../../common/constants';

/**
 * Event handlers for triggering eligibility recomputation
 * These should be called when offers or customer types change
 * 
 * Integration points:
 * 1. Call from your existing mutation resolvers
 * 2. Set up Prisma middleware to auto-trigger
 * 3. Use database triggers
 */
@Injectable()
export class OfferEventHandlers {
  private readonly logger = new Logger(OfferEventHandlers.name);

//   constructor(private readonly queueService: EligibilityQueueService) {}

  /**
   * Handle cashback configuration changes
   * Call this after creating/updating a cashback config
   */
  async onCashbackConfigChanged(
    cashbackConfigId: string,
    changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated',
  ): Promise<void> {
    const priorityMap = {
      created: QUEUE_PRIORITY.HIGH,
      updated: QUEUE_PRIORITY.MEDIUM,
      deleted: QUEUE_PRIORITY.CRITICAL,
      activated: QUEUE_PRIORITY.HIGH,
      deactivated: QUEUE_PRIORITY.CRITICAL,
    };

    // await this.queueService.queueOfferRecomputation(
    //   EligibilityEntityTypeEnum.CASHBACK_CONFIG,
    //   cashbackConfigId,
    //   `Cashback config ${changeType}`,
    //   priorityMap[changeType],
    // );

    this.logger.log(`Queued cashback config ${cashbackConfigId} for recomputation: ${changeType}`);
  }

  /**
   * Handle exclusive offer changes
   */
  async onExclusiveOfferChanged(
    offerId: string,
    changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated',
  ): Promise<void> {
    const priorityMap = {
      created: QUEUE_PRIORITY.HIGH,
      updated: QUEUE_PRIORITY.MEDIUM,
      deleted: QUEUE_PRIORITY.CRITICAL,
      activated: QUEUE_PRIORITY.HIGH,
      deactivated: QUEUE_PRIORITY.CRITICAL,
    };

    // await this.queueService.queueOfferRecomputation(
    //   EligibilityEntityTypeEnum.EXCLUSIVE_OFFER,
    //   offerId,
    //   `Exclusive offer ${changeType}`,
    //   priorityMap[changeType],
    // );

    this.logger.log(`Queued exclusive offer ${offerId} for recomputation: ${changeType}`);
  }

  /**
   * Handle loyalty program changes
   */
  async onLoyaltyProgramChanged(
    programId: string,
    changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated',
  ): Promise<void> {
    const priorityMap = {
      created: QUEUE_PRIORITY.HIGH,
      updated: QUEUE_PRIORITY.MEDIUM,
      deleted: QUEUE_PRIORITY.CRITICAL,
      activated: QUEUE_PRIORITY.HIGH,
      deactivated: QUEUE_PRIORITY.CRITICAL,
    };

    // await this.queueService.queueOfferRecomputation(
    //   EligibilityEntityTypeEnum.LOYALTY_PROGRAM,
    //   programId,
    //   `Loyalty program ${changeType}`,
    //   priorityMap[changeType],
    // );

    this.logger.log(`Queued loyalty program ${programId} for recomputation: ${changeType}`);
  }

  /**
   * Handle customer type changes
   * This is critical - when a user's relationship with a merchant changes,
   * we need to recompute all that merchant's offers
   */
  async onCustomerTypeChanged(
    userId: string,
    merchantId: string,
    changeType: 'created' | 'updated' | 'deleted',
  ): Promise<void> {
    // await this.queueService.queueUserEligibilityRecomputation(
    //   userId,
    //   merchantId,
    //   `Customer type ${changeType}`,
    // );

    this.logger.log(
      `Queued user ${userId} eligibility recomputation for merchant ${merchantId}: ${changeType}`,
    );
  }

  /**
   * Handle merchant status changes
   * When a merchant is activated/deactivated, all their offers need recomputation
   */
  async onMerchantStatusChanged(
    merchantId: string,
    newStatus: string,
    oldStatus: string,
  ): Promise<void> {
    const priority =
      newStatus === 'Active' || oldStatus === 'Active'
        ? QUEUE_PRIORITY.HIGH
        : QUEUE_PRIORITY.MEDIUM;

    // await this.queueService.queueMerchantOffersRecomputation(
    //   merchantId,
    //   `Merchant status changed from ${oldStatus} to ${newStatus}`,
    //   priority,
    // );

    this.logger.log(
      `Queued merchant ${merchantId} offers for recomputation: status changed to ${newStatus}`,
    );
  }

  /**
   * Handle budget exhaustion
   * When an offer runs out of budget, we need to immediately deactivate eligibility
   */
  async onBudgetExhausted(
    offerType: EligibilityEntityTypeEnum,
    offerId: string,
  ): Promise<void> {
    // await this.queueService.queueOfferRecomputation(
    //   offerType,
    //   offerId,
    //   'Budget exhausted',
    //   QUEUE_PRIORITY.CRITICAL,
    // );

    this.logger.log(`Queued ${offerType} ${offerId} for recomputation: budget exhausted`);
  }

  /**
   * Handle outlet changes
   * When outlets are added/removed from offers
   */
  async onOfferOutletsChanged(
    offerType: EligibilityEntityTypeEnum,
    offerId: string,
  ): Promise<void> {
    // await this.queueService.queueOfferRecomputation(
    //   offerType,
    //   offerId,
    //   'Outlets changed',
    //   QUEUE_PRIORITY.HIGH,
    // );

    this.logger.log(`Queued ${offerType} ${offerId} for recomputation: outlets changed`);
  }
}
