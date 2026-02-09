import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class LoyaltyTierType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  isActive: boolean;

  @Field()
  minCustomerType: string;
}
