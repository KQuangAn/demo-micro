// Query Use Case: Get Inventory Item

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GetInventoryItemQuery } from '../queries/get-inventory-item.query';
import { InventoryItemDto } from '../dtos/inventory-item.dto';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';

@Injectable()
export class GetInventoryItemUseCase {
  constructor(
    @Inject('IInventoryRepository')
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(query: GetInventoryItemQuery): Promise<InventoryItemDto> {
    const item = await this.inventoryRepository.findById(query.id);

    if (!item) {
      throw new NotFoundException(
        `Inventory item with id ${query.id} not found`,
      );
    }

    // Get latest price
    const price = await this.inventoryRepository.getLatestPrice(
      item.id,
      'USD', // Default currency, should come from query or config
    );

    if (!price) {
      throw new NotFoundException(`No price found for item ${item.id}`);
    }

    return InventoryItemDto.fromDomain(item, price);
  }

  async executeGetAll(): Promise<InventoryItemDto[]> {
    const items = await this.inventoryRepository.findAll();

    // Get prices for all items
    const itemsWithPrices = await Promise.all(
      items.map(async (item) => {
        const price = await this.inventoryRepository.getLatestPrice(
          item.id,
          'USD', // Default currency
        );

        // Skip items without prices or use a default
        if (!price) {
          return null;
        }

        return InventoryItemDto.fromDomain(item, price);
      }),
    );

    // Filter out null items
    return itemsWithPrices.filter(
      (item) => item !== null,
    ) as InventoryItemDto[];
  }
}
