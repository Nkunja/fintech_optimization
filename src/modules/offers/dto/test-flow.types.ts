import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class MerchantInfoType {
  @Field()
  id: string;
  @Field()
  businessName: string;
  @Field()
  category: string;
  @Field(() => String, { nullable: true })
  outletId?: string;
}

@ObjectType()
export class EligibleOfferEntryType {
  @Field()
  offerType: string;
  @Field()
  offerId: string;
  @Field()
  merchantName: string;
  @Field(() => String, { nullable: true })
  merchantCategory: string | null;
  @Field()
  outletName: string;
  @Field()
  hasBudgetRemaining: boolean;
}

@ObjectType()
export class EligibilitySummaryType {
  @Field()
  userId: string;
  @Field(() => Int)
  totalEligible: number;
  @Field(() => [EligibleOfferEntryType])
  offers: EligibleOfferEntryType[];
}

@ObjectType()
export class EligibilityMatrixEntryType {
  @Field()
  userId: string;
  @Field(() => Int)
  eligibleCount: number;
}

@ObjectType()
export class CreateTestOffersResultType {
  @Field()
  success: boolean;
  @Field()
  message: string;
  @Field()
  merchantId: string;
  @Field()
  merchantName: string;
  @Field()
  cashbackId: string;
  @Field()
  exclusiveId: string;
  @Field()
  loyaltyId: string;
  @Field(() => Int)
  eligibilityRecordsCreated: number;
}
