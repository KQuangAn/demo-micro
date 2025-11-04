// Kafka Event Consumer Service
// Manages Kafka consumers, registers handlers, and starts consumption

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerAdapter, MessageHandler } from './kafka-consumer.adapter';
import { KafkaConfig } from './kafka.config';
import { OrderEventHandler } from './handlers/order-event.handler';

@Injectable()
export class KafkaEventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaEventConsumerService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly orderEventHandler: OrderEventHandler,
    @Inject('KAFKA_CONFIG') private readonly kafkaConfig: KafkaConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerHandlers();
    await this.subscribe();
    await this.startConsuming();
  }

  private registerHandlers(): void {
    // Register order event handlers
    this.kafkaConsumer.registerHandler(
      'OrderCreatedEvent',
      this.orderEventHandler.handleOrderCreated.bind(
        this.orderEventHandler,
      ) as MessageHandler,
    );

    this.kafkaConsumer.registerHandler(
      'OrderCancelledEvent',
      this.orderEventHandler.handleOrderCancelled.bind(
        this.orderEventHandler,
      ) as MessageHandler,
    );

    this.kafkaConsumer.registerHandler(
      'OrderUpdatedEvent',
      this.orderEventHandler.handleOrderUpdated.bind(
        this.orderEventHandler,
      ) as MessageHandler,
    );

    this.logger.log('Registered all event handlers');
  }

  private async subscribe(): Promise<void> {
    const topics =
      this.kafkaConfig.subscribeTopics &&
      this.kafkaConfig.subscribeTopics.length > 0
        ? this.kafkaConfig.subscribeTopics
        : ['order.events'];
    await this.kafkaConsumer.subscribe(topics);
    this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
  }

  private async startConsuming(): Promise<void> {
    await this.kafkaConsumer.consume();
    this.logger.log('Kafka consumer started');
  }
}
