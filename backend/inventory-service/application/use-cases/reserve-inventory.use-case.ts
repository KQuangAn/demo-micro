// Reserve Inventory Use Case

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ReserveInventoryCommand } from '../commands/reserve-inventory.command';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';
import { IEventPublisher } from '../ports/event-publisher.interface';
import { InventoryDomainService } from '../../domain/services/inventory-domain.service';
import {
  InventoryReservedEvent,
  InsufficientInventoryEvent,
} from '../../domain/events/inventory.events';

@Injectable()
export class ReserveInventoryUseCase {
  constructor(
    @Inject('IInventoryRepository')
    private readonly inventoryRepository: IInventoryRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
    private readonly inventoryDomainService: InventoryDomainService,
  ) {}

  async execute(command: ReserveInventoryCommand): Promise<void> {
    // 1. Load all required items
    const itemIds = command.items.map((i) => i.productId);
    const items = await this.inventoryRepository.findByIds(itemIds);

    if (items.length !== itemIds.length) {
      throw new BadRequestException('Some products not found');
    }

    // 2. Create maps for business logic
    const itemsMap = new Map(items.map((item) => [item.id, item]));
    const reservationsMap = new Map(
      command.items.map((i) => [i.productId, i.quantity]),
    );

    // 3. Use domain service to validate and reserve
    try {
      this.inventoryDomainService.reserveMultipleItems(
        itemsMap,
        reservationsMap,
      );
    } catch (error) {
      // Publish failure event
      await this.eventPublisher.publish(
        new InsufficientInventoryEvent(
          command.userId,
          0, // Would need to calculate
          0,
        ),
      );
      throw new BadRequestException(error.message);
    }

    // 4. Persist changes
    for (const item of items) {
      await this.inventoryRepository.save(item);
    }

    // 5. Publish success events
    for (const item of items) {
      const reserved = reservationsMap.get(item.id) || 0;
      await this.eventPublisher.publish(
        new InventoryReservedEvent(item.id, reserved, command.userId),
      );
    }
  }
}
