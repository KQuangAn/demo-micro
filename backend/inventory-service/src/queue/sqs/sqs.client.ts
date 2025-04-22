import {
  DeleteMessageBatchCommand,
  DeleteMessageCommand,
  DeleteMessageCommandInput,
  DeleteMessageCommandOutput,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  ReceiveMessageCommandOutput,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { IQueueClient } from '../queue.client.interface';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SqsClient implements IQueueClient {
  private client: SQSClient;

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({
      region: config.get('AWS_REGION'),
      endpoint: config.get('QUEUE_URL'),
    });
  }

  async recieve(
    ...args: ReceiveMessageCommandInput[] & any
  ): Promise<ReceiveMessageCommandOutput> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.get('QUEUE_URL'),
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10,
      ...args,
    });
    return this.client.send(command);
  }

  async delete(...args: unknown[]): Promise<DeleteMessageCommandOutput> {
    const entries = args.map((handle: any, index) => ({
      Id: index.toString(),
      ReceiptHandle: handle?.ReceiptHandle,
    }));
    const command = new DeleteMessageBatchCommand({
      QueueUrl: this.config.get('QUEUE_URL'),
      Entries: entries,
    });

    return this.client.send(command);
  }
}
