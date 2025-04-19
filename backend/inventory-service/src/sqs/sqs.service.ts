import { Injectable, OnModuleInit } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly client = new SQSClient({ region: 'us-east-1' });
  private readonly queueUrl = process.env.SQS_ORDER_QUEUE_URL;

  constructor(private readonly inventoryService: InventoryService) {}

  async onModuleInit() {
    this.pollMessages();
  }

  async pollMessages() {
    while (true) {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
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
            await this.inventoryService.updateInventory({ productId, quantity });
          }

          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            }),
          );
        } catch (err) {
          console.error('Error processing SQS message', err);
        }
      }
    }
  }
}
