import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TestFlowService } from './test-flow.service';
import {
  MerchantInfoType,
  EligibilitySummaryType,
  EligibilityMatrixEntryType,
  CreateTestOffersResultType,
} from './dto/test-flow.types';


 // Test-flow resolver: create offers and view eligibility in GraphQL.
 
@Resolver()
export class TestFlowResolver {
  constructor(private readonly testFlow: TestFlowService) {}

  @Query(() => [String], {
    description: 'List of test user IDs. Use with HTTP header X-Test-User-Id to impersonate.',
  })
  testUsers(): string[] {
    return this.testFlow.getTestUserIds();
  }

  @Query(() => [MerchantInfoType], {
    description: 'List merchants (optionally active only). Use merchant id in createTestOffers.',
  })
  async merchants(
    @Args('activeOnly', { nullable: true, defaultValue: true }) activeOnly: boolean,
  ): Promise<MerchantInfoType[]> {
    return this.testFlow.getMerchants(activeOnly);
  }

  @Query(() => EligibilitySummaryType, {
    description: 'See all offers a user is eligible for (from UserOfferEligibility).',
  })
  async eligibilityForUser(
    @Args('userId', { description: 'e.g. user-dev-001' }) userId: string,
  ): Promise<EligibilitySummaryType> {
    return this.testFlow.getEligibilityForUser(userId);
  }

  @Query(() => [EligibilityMatrixEntryType], {
    description: 'Quick view: each test user and how many offers they are eligible for.',
  })
  async eligibilityMatrix(): Promise<EligibilityMatrixEntryType[]> {
    return this.testFlow.getEligibilityMatrix();
  }

  @Mutation(() => MerchantInfoType, {
    description: 'Create a test merchant + outlet. Returns merchant id for createTestOffers.',
  })
  async createTestMerchant(
    @Args('name', { description: 'Business name' }) name: string,
    @Args('category', { description: 'e.g. Retail, Food & Beverage' }) category: string,
  ): Promise<MerchantInfoType> {
    return this.testFlow.createTestMerchant(name, category);
  }

  @Mutation(() => CreateTestOffersResultType, {
    description:
      'Create cashback, exclusive, and loyalty offers for a merchant and make all test users eligible.',
  })
  async createTestOffers(
    @Args('merchantId', { description: 'From merchants query or createTestMerchant' }) merchantId: string,
  ): Promise<CreateTestOffersResultType> {
    return this.testFlow.createTestOffers(merchantId);
  }
}
