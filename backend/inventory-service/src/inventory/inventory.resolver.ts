// GraphQL Resolver - Presentation Layer
// Follows Clean Architecture by delegating to use cases

import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { GetInventoryItemUseCase } from '../../application/use-cases/get-inventory-item.use-case';
import { GetInventoryItemQuery } from '../../application/queries/get-inventory-item.query';
import { InventoryItemDto } from '../../application/dtos/inventory-item.dto';

// GraphQL Input Types (presentation layer DTOs)
import { Field, Float } from '@nestjs/graphql';

// No GraphQL mutations here; mutations are handled via Kafka events.

// GraphQL Object Type for responses
import { ObjectType } from '@nestjs/graphql';

@ObjectType()
class InventoryItem {
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

  @Field(() => Float)
  quantity: number;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field({ nullable: true })
  currencyName?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@Resolver(() => InventoryItem)
export class InventoryResolver {
  constructor(
    @Inject(GetInventoryItemUseCase)
    private readonly getInventoryItemUseCase: GetInventoryItemUseCase,
  ) {}

  @Query(() => InventoryItem, { name: 'inventory' })
  async getInventory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<InventoryItemDto> {
    const query = new GetInventoryItemQuery(id);
    return await this.getInventoryItemUseCase.execute(query);
  }

  @Query(() => [InventoryItem], { name: 'allInventory' })
  async allInventory(): Promise<InventoryItemDto[]> {
    return await this.getInventoryItemUseCase.executeGetAll();
  }
}
