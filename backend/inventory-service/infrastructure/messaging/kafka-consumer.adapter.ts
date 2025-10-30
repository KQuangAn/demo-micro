// Kafka Consumer Adapter
// Infrastructure adapter for consuming messages from Kafka

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Kafka,
  Consumer,
  ConsumerSubscribeTopics,
  EachMessagePayload,
  ConsumerRunConfig,
} from 'kafkajs';
import { KafkaConfig, KafkaMessage } from './kafka.config';

export type MessageHandler<T = any> = (
  message: KafkaMessage<T>,
) => Promise<void>;

@Injectable()
export class KafkaConsumerAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerAdapter.name);
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly messageHandlers = new Map<string, MessageHandler>();

  constructor(
    private readonly config: KafkaConfig,
    private readonly groupId: string,
  ) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
      retry: config.retry || {
        maxRetryTime: 30000,
        initialRetryTime: 300,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      rebalanceTimeout: 60000,
      retry: {
        retries: 10,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.logger.log(
        `Kafka Consumer connected successfully (group: ${this.groupId})`,
      );
    } catch (error) {
      this.logger.error('Failed to connect Kafka Consumer', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      this.logger.log('Kafka Consumer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka Consumer', error);
      throw error;
    }
  }

  async subscribe(topics: string[] | ConsumerSubscribeTopics): Promise<void> {
    try {
      if (Array.isArray(topics)) {
        await this.consumer.subscribe({
          topics,
          fromBeginning: false,
        });
        this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
      } else {
        await this.consumer.subscribe(topics);
        this.logger.log(`Subscribed to topics pattern`);
      }
    } catch (error) {
      this.logger.error('Failed to subscribe to topics', error);
      throw error;
    }
  }

  registerHandler(eventType: string, handler: MessageHandler): void {
    this.messageHandlers.set(eventType, handler);
    this.logger.debug(`Registered handler for event type: ${eventType}`);
  }

  async consume(): Promise<void> {
    const config: ConsumerRunConfig = {
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    };

    try {
      await this.consumer.run(config);
      this.logger.log('Kafka Consumer started consuming messages');
    } catch (error) {
      this.logger.error('Error running Kafka Consumer', error);
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const kafkaMessage: KafkaMessage = JSON.parse(
        message.value?.toString() || '{}',
      );

      const eventType =
        kafkaMessage.eventType ||
        message.headers?.['event-type']?.toString() ||
        '';

      this.logger.debug(
        `Received message: ${eventType} from topic ${topic} [${partition}] offset ${message.offset}`,
      );

      const handler = this.messageHandlers.get(eventType);

      if (handler) {
        await handler(kafkaMessage);
        this.logger.debug(`Successfully handled message: ${eventType}`);
      } else {
        this.logger.warn(`No handler registered for event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing message from topic ${topic} [${partition}] offset ${message.offset}`,
        error,
      );
      // Consider implementing DLQ (Dead Letter Queue) here
      throw error;
    }
  }

  async commitOffsets(
    topics: Array<{ topic: string; partition: number; offset: string }>,
  ): Promise<void> {
    try {
      await this.consumer.commitOffsets(topics);
      this.logger.debug('Committed offsets successfully');
    } catch (error) {
      this.logger.error('Failed to commit offsets', error);
      throw error;
    }
  }
}
