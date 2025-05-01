import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { InventoryService } from './inventory.service';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { UpdateInventoryInput } from './dto/update.inventory.input';
import { Inventory } from './entities/inventory.entity';
import { ReserveInventoryInput } from './dto/reserve.inventory.input';

@Resolver(() => Inventory)
export class InventoryResolver {
  constructor(private inventoryService: InventoryService) {}

  @Query(() => Inventory)
  async getInventory(@Args('id', { type: () => ID }) id: string) {
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

  @Mutation(() => [Inventory]) 
  async handleReserveInventory(
    @Args('reserveInventoryInput') reserveInventoryInput: ReserveInventoryInput,
  ) {
    return this.inventoryService.handleReserveInventory(reserveInventoryInput);
  }
}
