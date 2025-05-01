import { Injectable } from '@nestjs/common';
import { IMessageHandler } from './message-handler.interface';
import { InventoryService } from 'src/inventory/inventory.service';
import { EventType, TMessage } from 'src/common/types';
import { isOrders } from 'src/common/util';

@Injectable()
export class InventoryMessageHandler implements IMessageHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  async process(message: TMessage): Promise<unknown> {
    const type = message?.['detail-type'];
    const payload = message?.detail;
    console.log(type, payload, message);
    switch (type) {
      case EventType.OrderUpdated: {
        if (isOrders(payload)) {
          return await this.inventoryService.handleOrderUpdated(payload);
        }
      }
      case EventType.OrderCancelledByUser: {
        if (isOrders(payload)) {
          return await this.inventoryService.handleOrderCancelled(payload);
        }
      }
      default: {
        console.log(type, payload);
        console.warn('No handler for this event');
        return;
      }
    }
  }
}
