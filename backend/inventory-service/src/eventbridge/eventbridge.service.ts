import { Injectable } from '@nestjs/common';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

@Injectable()
export class EventBridgeService {
  private client = new EventBridgeClient({ region: 'ap-southest-1' });

  async publishInventoryUpdated(productId: string, quantity: number) {
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: 'app-events',
          Source: 'inventory.service',
          DetailType: 'InventoryUpdated',
          Detail: JSON.stringify({ productId, quantity }),
        },
      ],
    });

    await this.client.send(command);
  }
}
