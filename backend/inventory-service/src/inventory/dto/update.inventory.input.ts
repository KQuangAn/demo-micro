import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateInventoryInput {
  @Field()
  id: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  brand?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [String], { nullable: true })
  images?: string[];

  @Field(() => [String], { nullable: true })
  categories?: string[];

  @Field({ nullable: true })
  quantity?: number;

  @Field({ nullable: true })
  price: number;
}
