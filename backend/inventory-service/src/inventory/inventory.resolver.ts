import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { InventoryService } from './inventory.service';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { UpdateInventoryInput } from './dto/update-inventory.input';
import { Inventory } from './entities/inventory.entity';

@Resolver(() => Inventory)
export class InventoryResolver {
  constructor(private inventoryService: InventoryService) {}

  @Query(() => Inventory)
  async getInventory(@Args('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Query(() => [Inventory])
  async allInventory() {
    return this.inventoryService.findAll();
  }

  @Mutation(() => Inventory)
  async createInventory(
    @Args('createInventoryInput') createInventoryInput: CreateInventoryInput,
  ) {
    return this.inventoryService.create(createInventoryInput);
  }

  @Mutation(() => Inventory)
  async updateInventory(
    @Args('updateInventoryInput') updateInventoryInput: UpdateInventoryInput,
  ) {
    return this.inventoryService.update(
      updateInventoryInput.id,
      updateInventoryInput,
    );
  }

  @Mutation(() => Inventory)
  async removeInventory(@Args('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
