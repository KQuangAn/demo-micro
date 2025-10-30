// Use Case: Create Inventory Item
// Application logic that orchestrates domain objects and infrastructure

import { Injectable, Inject } from '@nestjs/common';
import { CreateInventoryItemCommand } from '../commands/create-inventory-item.command';
import { InventoryItemDto } from '../dtos/inventory-item.dto';
import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { Price, Currency } from '../../domain/value-objects/price.vo';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';
import { IEventPublisher } from '../ports/event-publisher.interface';
import { InventoryItemCreatedEvent } from '../../domain/events/inventory.events';

@Injectable()
export class CreateInventoryItemUseCase {
  constructor(
    @Inject('IInventoryRepository')
    private readonly inventoryRepository: IInventoryRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    command: CreateInventoryItemCommand,
  ): Promise<InventoryItemDto> {
    // 1. Create domain entity with business rules
    const inventoryItem = InventoryItem.create({
      title: command.title,
      brand: command.brand,
      description: command.description,
      images: command.images,
      categories: command.categories,
      quantity: command.quantity,
    });

    // 2. Create price value object
    const currency = Currency.create(
      command.currencyCode,
      command.currencyCode,
      '$',
    );
    const price = Price.create(command.price, currency);

    // 3. Persist to database
    await this.inventoryRepository.save(inventoryItem);
    await this.inventoryRepository.savePrice(inventoryItem.id, price);

    // 4. Publish domain event
    const event = new InventoryItemCreatedEvent(
      inventoryItem.id,
      inventoryItem.title,
      inventoryItem.brand,
      inventoryItem.quantity,
    );
    await this.eventPublisher.publish(event);

    // 5. Return DTO
    return InventoryItemDto.fromDomain(inventoryItem, price);
  }
}
