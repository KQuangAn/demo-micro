import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { ConfigService } from '@nestjs/config';
import { IEventEmitter } from '../event-emitter.interface';

//adapter file
export class EventBridge implements IEventEmitter {
  private client: EventBridgeClient;
  constructor(private readonly config: ConfigService) {
    console.log(this.config?.get('AWS_REGION'));

    this.client = new EventBridgeClient({
      region: this.config?.get('AWS_REGION'),
    });
  }
  async emit(event: PutEventsRequestEntry[] | PutEventsRequestEntry) {
    const entries = Array.isArray(event) ? event : [event];

    const command = new PutEventsCommand({
      Entries: entries,
    });

    await this.client.send(command);
  }
}
