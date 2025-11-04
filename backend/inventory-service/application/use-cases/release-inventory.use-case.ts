// Release Inventory Use Case

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ReleaseInventoryCommand } from '../commands/release-inventory.command';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';
import { IEventPublisher } from '../ports/event-publisher.interface';
import { InventoryReleasedEvent } from '../../domain/events/inventory.events';

@Injectable()
export class ReleaseInventoryUseCase {
  constructor(
    @Inject('IInventoryRepository')
    private readonly inventoryRepository: IInventoryRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: ReleaseInventoryCommand): Promise<void> {
    const itemIds = command.items.map((i) => i.productId);
    const items = await this.inventoryRepository.findByIds(itemIds);

    if (items.length !== itemIds.length) {
      throw new BadRequestException('Some products not found');
    }

    const itemsMap = new Map(items.map((item) => [item.id, item]));

    // Apply releases
    for (const { productId, quantity } of command.items) {
      const item = itemsMap.get(productId);
      if (!item) {
        throw new BadRequestException(`Product not found: ${productId}`);
      }
      item.releaseQuantity(quantity);
    }

    // Persist updates
    for (const item of items) {
      await this.inventoryRepository.save(item);
    }

    // Publish events
    for (const { productId, quantity, reason } of command.items) {
      await this.eventPublisher.publish(
        new InventoryReleasedEvent(
          productId,
          quantity,
          reason ?? 'order_cancelled',
        ),
      );
    }
  }
}
