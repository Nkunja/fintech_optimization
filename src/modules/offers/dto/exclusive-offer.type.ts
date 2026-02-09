import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ExclusiveOfferType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  isActive: boolean;

  @Field()
  netOfferBudget: number;

  @Field()
  usedOfferBudget: number;
}
