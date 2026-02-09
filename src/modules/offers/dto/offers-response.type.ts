import { ObjectType, Field } from '@nestjs/graphql';
import { OutletType } from './outlet.type';

@ObjectType()
export class OffersResponseType {
  @Field(() => [OutletType])
  outlets: OutletType[];

  @Field()
  totalCount: number;
}
