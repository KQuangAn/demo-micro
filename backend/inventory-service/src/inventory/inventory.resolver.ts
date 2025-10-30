// GraphQL Resolver - Presentation Layer
// Follows Clean Architecture by delegating to use cases

import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { CreateInventoryItemUseCase } from '../../application/use-cases/create-inventory-item.use-case';
import { GetInventoryItemUseCase } from '../../application/use-cases/get-inventory-item.use-case';
import { ReserveInventoryUseCase } from '../../application/use-cases/reserve-inventory.use-case';
import { CreateInventoryItemCommand } from '../../application/commands/create-inventory-item.command';
import { ReserveInventoryCommand } from '../../application/commands/reserve-inventory.command';
import { GetInventoryItemQuery } from '../../application/queries/get-inventory-item.query';
import { InventoryItemDto } from '../../application/dtos/inventory-item.dto';

// GraphQL Input Types (presentation layer DTOs)
import { InputType, Field, Float } from '@nestjs/graphql';

@InputType()
class CreateInventoryInput {
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

  @Field(() => Float)
  price: number;

  @Field()
  currencyCode: string;
}

@InputType()
class ReserveInventoryInput {
  @Field()
  userId: string;

  @Field(() => [ReserveItemInput])
  items: ReserveItemInput[];
}

@InputType()
class ReserveItemInput {
  @Field()
  productId: string;

  @Field(() => Float)
  quantity: number;

  @Field()
  currency: string;
}

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
    @Inject(CreateInventoryItemUseCase)
    private readonly createInventoryItemUseCase: CreateInventoryItemUseCase,
    @Inject(GetInventoryItemUseCase)
    private readonly getInventoryItemUseCase: GetInventoryItemUseCase,
    @Inject(ReserveInventoryUseCase)
    private readonly reserveInventoryUseCase: ReserveInventoryUseCase,
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

  @Mutation(() => InventoryItem)
  async createInventory(
    @Args('createInventoryInput') input: CreateInventoryInput,
  ): Promise<InventoryItemDto> {
    const command = new CreateInventoryItemCommand(
      input.title,
      input.brand,
      input.description,
      input.images,
      input.categories,
      input.quantity,
      input.price,
      input.currencyCode,
    );

    return await this.createInventoryItemUseCase.execute(command);
  }

  @Mutation(() => [InventoryItem])
  async reserveInventory(
    @Args('reserveInventoryInput') input: ReserveInventoryInput,
  ): Promise<{ success: boolean; message: string }> {
    const command = new ReserveInventoryCommand(input.userId, input.items);

    await this.reserveInventoryUseCase.execute(command);

    return {
      success: true,
      message: 'Inventory reserved successfully',
    };
  }
}
