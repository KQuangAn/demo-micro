import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { IEventEmitter } from '../event-emitter.interface';
import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventType } from 'src/common/types';
import { createEvent } from 'src/common/util';

//adapter file

@Injectable()
export class EventBridge implements IEventEmitter {
  private client: EventBridgeClient;
  constructor(private config: ConfigService) {
    this.client = new EventBridgeClient({
      region: this.config.get('AWS_REGION'),
      endpoint: this.config.get('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID') || 'test',
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY') || 'test',
      },
    });
  }

  async emit(event: PutEventsRequestEntry[] | PutEventsRequestEntry) {
    const entries = Array.isArray(event) ? event : [event];

    console.log(entries, 'entries');

    const command = new PutEventsCommand({
      Entries: entries,
    });
    await this.client.send(command);
  }
}
