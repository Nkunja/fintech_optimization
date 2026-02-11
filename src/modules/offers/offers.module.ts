import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersResolver } from './offers.resolver';
import { TestFlowService } from './test-flow.service';
import { TestFlowResolver } from './test-flow.resolver';

@Module({
  providers: [OffersService, OffersResolver, TestFlowService, TestFlowResolver],
  exports: [OffersService, TestFlowService],
})
export class OffersModule {}
