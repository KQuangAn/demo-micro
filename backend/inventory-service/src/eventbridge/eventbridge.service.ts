import { Injectable } from '@nestjs/common';
import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';

@Injectable()
export class EventBridgeService {
  private client = new EventBridgeClient({ region: 'ap-southest-1' });

  async publishEvents(event: PutEventsRequestEntry[]) {
    const command = new PutEventsCommand({
      Entries: event
    });

    await this.client.send(command);
  }
}
