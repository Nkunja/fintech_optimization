import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class MerchantType {
  @Field()
  id: string;

  @Field()
  businessName: string;

  @Field({ nullable: true })
  category?: string;

  @Field()
  status: string;
}
