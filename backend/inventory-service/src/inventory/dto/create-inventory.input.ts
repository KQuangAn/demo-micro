import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateInventoryInput {
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

  @Field()
  quantity: number;

  @Field()
  price: number;

  @Field()
  discount: number;
}
