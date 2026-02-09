import { ObjectType, Field } from '@nestjs/graphql';
import { MerchantType } from './merchant.type';
import { CashbackConfigurationType } from './cashback-config.type';
import { ExclusiveOfferType } from './exclusive-offer.type';

@ObjectType()
export class OutletType {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isActive: boolean;

  @Field()
  merchantId: string;

  @Field(() => MerchantType, { nullable: true })
  Merchant?: MerchantType;

  @Field(() => [CashbackConfigurationType])
  CashbackConfigurations: CashbackConfigurationType[];

  @Field(() => [ExclusiveOfferType])
  ExclusiveOffers: ExclusiveOfferType[];
}
