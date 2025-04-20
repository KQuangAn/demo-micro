import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateInventoryInput {
  @Field()
  description: string;

  @Field()
  name: string;

  @Field()
  quantity: number;

  @Field()
  price: number;
}
