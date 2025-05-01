import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class ReserveInventoryInput {
  @Field()
  userId: string;

  @Field(() => [ProductInput])
  products: ProductInput[];
}

@InputType()
export class ProductInput {
  @Field()
  productId: string;

  @Field()
  quantity: number;

  @Field()
  currency: string;
}