import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class Inventory {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  price: number;

  @Field()
  updatedAt: string;
}
