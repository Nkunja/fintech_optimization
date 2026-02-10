import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { EligibilityComputationService } from './eligibility-computation.service';
import { EligibilityQueueService } from './eligibility-queue.service';
import type { EligibilityJob } from './eligibility-queue.service';
import { EligibilityEntityTypeEnum } from '@prisma/client';

@Processor('eligibility-computation')
export class EligibilityProcessor {
  private readonly logger = new Logger(EligibilityProcessor.name);

  constructor(
    private readonly computationService: EligibilityComputationService,
    private readonly queueService: EligibilityQueueService,
  ) {}

  @Process('compute-eligibility')
  async handleEligibilityComputation(job: Job<EligibilityJob>): Promise<void> {
    const { entityType, entityId, reason } = job.data;

    this.logger.log(`Processing eligibility computation: ${entityType} ${entityId} - ${reason}`);

    try {
      let recordsAffected = 0;

      switch (entityType) {
        case EligibilityEntityTypeEnum.CASHBACK_CONFIG:
          recordsAffected = await this.computationService.computeCashbackEligibility(entityId);
          break;

        case EligibilityEntityTypeEnum.EXCLUSIVE_OFFER:
          recordsAffected =
            await this.computationService.computeExclusiveOfferEligibility(entityId);
          break;

        case EligibilityEntityTypeEnum.LOYALTY_PROGRAM:
          recordsAffected =
            await this.computationService.computeLoyaltyProgramEligibility(entityId);
          break;

        default:
          this.logger.warn(`Unknown entity type: ${entityType}`);
          return;
      }

      await this.queueService.markCompleted(entityType, entityId);

      this.logger.log(
        `Completed eligibility computation for ${entityType} ${entityId}: ${recordsAffected} records`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to compute eligibility for ${entityType} ${entityId}`,
        error,
      );

      await this.queueService.markFailed(entityType, entityId, errorMessage);

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  }
}
