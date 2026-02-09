import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class CashbackTierType {
  @Field()
  id: string;

  @Field()
  cashbackPercentage: number;

  @Field({ nullable: true })
  minTransactionAmount?: number;

  @Field({ nullable: true })
  maxTransactionAmount?: number;
}
