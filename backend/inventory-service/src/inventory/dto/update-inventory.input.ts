import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateInventoryInput {
  @Field()
  productId: string;

  @Field()
  quantity: number;
}
