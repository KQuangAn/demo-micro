import { Injectable, OnModuleInit } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { InventoryService } from '../inventory/inventory.service';
import { IQueueService } from './queue.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService implements OnModuleInit, IQueueService {
  private readonly client = new SQSClient({ region: process.env.AWS_REGION, endpoint: this.queueUrl });
  private readonly queueUrl: string;

  constructor(private readonly client: SQSClient, private readonly inventoryService: InventoryService, private readonly configService: ConfigService) {
    this.queueUrl = this.configService.get<string>('SQS_QUEUE_URL')!;
  }

  async onModuleInit() {
    this.pollMessages();
  }

  async pollMessages() {
    const queueUrl = this.configService.get("SQS_QUEUE_URL");
    while (true) {
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      });

      const response = await this.client.send(command);

      for (const message of response.Messages || []) {
        try {
          const body = JSON.parse(message.Body ?? '{}');
          const detail = JSON.parse(body?.detail ?? '{}');

          const { productId, quantity } = detail;

          if (productId && quantity !== undefined) {
            await this.inventoryService.update(productId, { quantity });
          }

          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            }),
          );
        } catch (err) {
          console.error('Error processing message', err);
        }
      }
    }
  }
}
