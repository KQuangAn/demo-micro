import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateInventoryInput {
  @Field()
  id: string;

  @Field()
  quantity: number;
}
