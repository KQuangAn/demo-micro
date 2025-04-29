import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { IQueueService } from './queue.service.interface';
import { IQueueClient } from './queue.client.interface';
import { QueueMessage } from 'src/common/types';
import { IMessageHandler } from './message-handler/message-handler.interface';

@Injectable()
export class QueueService implements OnModuleInit, IQueueService {
  constructor(
    @Inject('QUEUE_CLIENT') private client: IQueueClient,
    @Inject('MESSAGE_HANLDER') private readonly messageHandler: IMessageHandler,
  ) {}

  async onModuleInit() {
    this.pollMessages();
  }

  async pollMessages() {
    while (true) {
      const response: any = await this.client.recieve();

      for (const message of response?.Messages || []) {
        try {
          //validate
          const body = JSON.parse(message?.Body ?? '{}');
          //const detail = JSON.parse(body?.detail ?? '{}');
          console.log(body, 'recevied message');
          QueueMessage.parse(body);
          //process
          await this.messageHandler.process(body);
          //delete if process with no error
          await this.client.delete(message);
        } catch (err) {
          console.error('Error processing message', err);
        }
      }
    }
  }
}
