import { ObjectType, Field } from '@nestjs/graphql';
import { MerchantType } from './merchant.type';
import { LoyaltyTierType } from './loyalty-tier.type';
import { MerchantLoyaltyRewardType } from './loyalty-reward.type';

@ObjectType()
export class LoyaltyProgramType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isActive: boolean;

  @Field(() => MerchantType, { nullable: true })
  Merchant?: MerchantType;

  @Field(() => [LoyaltyTierType])
  LoyaltyTiers: LoyaltyTierType[];

  @Field(() => [MerchantLoyaltyRewardType])
  MerchantLoyaltyRewards: MerchantLoyaltyRewardType[];
}
