import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class MerchantLoyaltyRewardType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  pointsCost: number;

  @Field()
  isActive: boolean;
}
