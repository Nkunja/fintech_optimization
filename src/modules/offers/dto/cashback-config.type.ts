import { ObjectType, Field } from '@nestjs/graphql';
import { CashbackTierType } from './cashback-tier.type';

@ObjectType()
export class CashbackConfigurationType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  startDate?: string;

  @Field({ nullable: true })
  endDate?: string;

  @Field()
  isActive: boolean;

  @Field()
  netCashbackBudget: number;

  @Field()
  usedCashbackBudget: number;

  @Field(() => [CashbackTierType], { nullable: true })
  CashbackConfigurationTiers?: CashbackTierType[];
}
