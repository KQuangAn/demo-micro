import { ObjectType, Field, ID, Int, Float, Directive } from '@nestjs/graphql';
import { DateScalar } from 'src/graphql/date.scalar';

@ObjectType()
@Directive('@key(fields: "id")')
export class Inventory {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  brand: string;

  @Field(() => String)
  description: string;

  @Field(() => [String])
  images: string[];

  @Field(() => [String])
  categories: string[];

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  price: number;

  @Field(() => String)
  currencyName: string;

  @Field(() => DateScalar)
  createdAt: Date;

  @Field(() => DateScalar)
  updatedAt: Date;
}
