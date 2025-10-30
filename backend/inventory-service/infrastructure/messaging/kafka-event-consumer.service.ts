// Kafka Event Consumer Service
// Manages Kafka consumers, registers handlers, and starts consumption

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerAdapter } from './kafka-consumer.adapter';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS } from './kafka.config';
import { OrderEventHandler } from './handlers/order-event.handler';

@Injectable()
export class KafkaEventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaEventConsumerService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly orderEventHandler: OrderEventHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerHandlers();
    await this.subscribe();
    await this.startConsuming();
  }

  private async registerHandlers(): Promise<void> {
    // Register order event handlers
    this.kafkaConsumer.registerHandler(
      'OrderCreatedEvent',
      this.orderEventHandler.handleOrderCreated.bind(this.orderEventHandler),
    );

    this.kafkaConsumer.registerHandler(
      'OrderCancelledEvent',
      this.orderEventHandler.handleOrderCancelled.bind(this.orderEventHandler),
    );

    this.kafkaConsumer.registerHandler(
      'OrderUpdatedEvent',
      this.orderEventHandler.handleOrderUpdated.bind(this.orderEventHandler),
    );

    this.logger.log('Registered all event handlers');
  }

  private async subscribe(): Promise<void> {
    const topics = [
      KAFKA_TOPICS.ORDER_CREATED,
      KAFKA_TOPICS.ORDER_CANCELLED,
      KAFKA_TOPICS.ORDER_UPDATED,
    ];

    await this.kafkaConsumer.subscribe(topics);
    this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
  }

  private async startConsuming(): Promise<void> {
    await this.kafkaConsumer.consume();
    this.logger.log('Kafka consumer started');
  }
}
