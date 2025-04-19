import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { InventoryService } from './inventory.service';
import { UpdateInventoryInput } from './dto/update-inventory.input';
import { ObjectType, Field } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/jwt/jwt.guard';

@ObjectType()
class Inventory {
  @Field()
  id: string;

  @Field()
  productId: string;

  @Field()
  quantity: number;
}

@UseGuards(JwtAuthGuard)
@Resolver()
export class InventoryResolver {
  constructor(private readonly inventoryService: InventoryService) {}

  @Mutation(() => Inventory)
  updateInventory(@Args('data') data: UpdateInventoryInput) {
    return this.inventoryService.updateInventory(data);
  }
}
