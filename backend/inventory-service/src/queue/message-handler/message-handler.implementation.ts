import { Injectable } from '@nestjs/common';
import { IMessageHandler } from './message-handler.interface';
import { InventoryService } from 'src/inventory/inventory.service';
import { EventType, TQueueMessage } from 'src/common/types';

@Injectable()
export class InventoryMessageHandler implements IMessageHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  async process(message: TQueueMessage): Promise<unknown> {
    switch (message['detail-type']) {
      case EventType.OrdersCreated: {
        return await this.inventoryService.handleOrderCreated(message.detail);
      }
      case EventType.OrdersCreated: {
        return await this.inventoryService.handleOrderUpdated(message.detail);
      }
      case EventType.OrdersCancelled: {
        return await this.inventoryService.handleOrderCancelled(message.detail);
      }
      default: {
        return;
      }
    }
  }
}
