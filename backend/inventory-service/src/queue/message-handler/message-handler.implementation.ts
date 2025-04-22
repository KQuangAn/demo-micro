import { Injectable } from '@nestjs/common';
import { IMessageHandler } from './message-handler.interface';
import { InventoryService } from 'src/inventory/inventory.service';
import { EventType, TQueueMessage } from 'src/common/types';
import { isOrders } from 'src/common/util';

@Injectable()
export class InventoryMessageHandler implements IMessageHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  async process(message: TQueueMessage): Promise<unknown> {
    switch (message['detail-type']) {
      case EventType.OrdersCreated: {
        if (isOrders(message.detail)) {
          return await this.inventoryService.handleOrderCreated(message.detail);
        }
      }
      case EventType.OrdersCreated: {
        if (isOrders(message.detail)) {
          return await this.inventoryService.handleOrderUpdated(message.detail);
        }
      }
      case EventType.OrdersCancelled: {
        if (isOrders(message.detail)) {
          return await this.inventoryService.handleOrderCancelled(
            message.detail,
          );
        }
      }
      default: {
        return;
      }
    }
  }
}
