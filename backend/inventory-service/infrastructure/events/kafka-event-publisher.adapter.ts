// Kafka Event Publisher Adapter
// Adapts Kafka Producer to domain IEventPublisher interface
// Publishes domain events to Kafka topics for event-driven architecture

import { Injectable, Logger } from '@nestjs/common';
import { IEventPublisher } from '../../application/ports/event-publisher.interface';
import { DomainEvent } from '../../domain/events/inventory.events';
import { KafkaProducerAdapter } from '../messaging/kafka-producer.adapter';
import { KAFKA_TOPICS, KafkaMessage } from '../messaging/kafka.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KafkaEventPublisherAdapter implements IEventPublisher {
  private readonly logger = new Logger(KafkaEventPublisherAdapter.name);

  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async publish(event: DomainEvent): Promise<void> {
    try {
      const topic = this.getTopicForEvent(event);
      const kafkaMessage = this.toKafkaMessage(event);

      await this.kafkaProducer.publish(topic, kafkaMessage, event.aggregateId);

      this.logger.debug(
        `Published domain event ${event.constructor.name} to Kafka topic ${topic}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish domain event ${event.constructor.name}`,
        error,
      );
      throw error;
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    // Group events by topic for batch publishing
    const eventsByTopic = new Map<string, DomainEvent[]>();

    for (const event of events) {
      const topic = this.getTopicForEvent(event);
      const topicEvents = eventsByTopic.get(topic) || [];
      topicEvents.push(event);
      eventsByTopic.set(topic, topicEvents);
    }

    // Publish all events in parallel (batch per topic)
    await Promise.all(
      Array.from(eventsByTopic.entries()).map(([topic, topicEvents]) =>
        this.publishBatch(topic, topicEvents),
      ),
    );
  }

  private async publishBatch(
    topic: string,
    events: DomainEvent[],
  ): Promise<void> {
    try {
      const kafkaMessages = events.map((event) => this.toKafkaMessage(event));

      await this.kafkaProducer.publishBatch(topic, kafkaMessages);

      this.logger.debug(
        `Published ${events.length} domain events to Kafka topic ${topic}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish batch of events to topic ${topic}`,
        error,
      );
      throw error;
    }
  }

  private getTopicForEvent(event: DomainEvent): string {
    const eventName = event.constructor.name;

    // Map domain event names to Kafka topics
    const topicMapping: Record<string, string> = {
      InventoryItemCreatedEvent: KAFKA_TOPICS.INVENTORY_CREATED,
      InventoryItemUpdatedEvent: KAFKA_TOPICS.INVENTORY_UPDATED,
      InventoryItemDeletedEvent: KAFKA_TOPICS.INVENTORY_DELETED,
      InventoryItemReservedEvent: KAFKA_TOPICS.INVENTORY_RESERVED,
      InventoryItemReleasedEvent: KAFKA_TOPICS.INVENTORY_RELEASED,
      InsufficientInventoryEvent: KAFKA_TOPICS.INSUFFICIENT_INVENTORY,
    };

    const topic = topicMapping[eventName];

    if (!topic) {
      throw new Error(`No Kafka topic mapped for event: ${eventName}`);
    }

    return topic;
  }

  private toKafkaMessage<T extends DomainEvent>(event: T): KafkaMessage {
    return {
      eventId: uuidv4(),
      eventType: event.constructor.name,
      timestamp: event.occurredOn,
      payload: {
        ...event,
      },
      metadata: {
        correlationId: uuidv4(), // Should be passed from request context
      },
    };
  }
}
