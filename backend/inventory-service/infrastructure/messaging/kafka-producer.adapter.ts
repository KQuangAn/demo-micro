// Kafka Producer Adapter
// Infrastructure adapter for publishing messages to Kafka

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { KafkaConfig, KafkaMessage } from './kafka.config';

@Injectable()
export class KafkaProducerAdapter implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerAdapter.name);
  private producer: Producer;
  private kafka: Kafka;

  constructor(private readonly config: KafkaConfig) {
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

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.log('Kafka Producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka Producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka Producer', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async publish<T = any>(
    topic: string,
    message: KafkaMessage<T>,
    key?: string,
  ): Promise<RecordMetadata[]> {
    try {
      const record: ProducerRecord = {
        topic,
        messages: [
          {
            key: key || message.eventId,
            value: JSON.stringify(message),
            timestamp: Date.now().toString(),
            headers: {
              'event-type': message.eventType,
              'event-id': message.eventId,
              ...(message.metadata?.correlationId && {
                'correlation-id': message.metadata.correlationId,
              }),
            },
          },
        ],
      };

      const result = await this.producer.send(record);

      this.logger.debug(
        `Published event ${message.eventType} to topic ${topic}`,
        {
          eventId: message.eventId,
          topic,
          partition: result[0].partition,
          offset: result[0].offset,
        },
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${message.eventType} to topic ${topic}`,
        error,
      );
      throw error;
    }
  }

  async publishBatch<T = any>(
    topic: string,
    messages: KafkaMessage<T>[],
  ): Promise<RecordMetadata[]> {
    try {
      const record: ProducerRecord = {
        topic,
        messages: messages.map((message) => ({
          key: message.eventId,
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
          headers: {
            'event-type': message.eventType,
            'event-id': message.eventId,
          },
        })),
      };

      const result = await this.producer.send(record);

      this.logger.debug(
        `Published ${messages.length} events to topic ${topic}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to publish batch to topic ${topic}`, error);
      throw error;
    }
  }
}
