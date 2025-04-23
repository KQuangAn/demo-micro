import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { DateScalar } from 'src/graphql/date.scalar';

@ObjectType()
export class Inventory {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  brand: string;

  @Field()
  description: string;

  @Field(() => [String])
  images: string[];

  @Field(() => [String])
  categories: string[];

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  price: number;

  @Field(() => Float, { nullable: true })
  discount?: number;

  @Field(() => DateScalar)
  createdAt: Date;

  @Field(() => DateScalar)
  updatedAt: Date;
}
