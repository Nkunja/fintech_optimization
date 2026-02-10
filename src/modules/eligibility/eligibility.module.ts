import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EligibilityComputationService } from './eligibility-computation.service';
import { EligibilityQueueService } from './eligibility-queue.service';
import { EligibilityProcessor } from './eligibility.processor';
import { EligibilityScheduler } from './eligibility.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'eligibility-computation',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    EligibilityComputationService,
    EligibilityQueueService,
    EligibilityProcessor,
    EligibilityScheduler,
  ],
  exports: [EligibilityComputationService, EligibilityQueueService],
})
export class EligibilityModule {}
