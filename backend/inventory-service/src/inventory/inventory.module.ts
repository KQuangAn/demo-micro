// Inventory Module - Clean Architecture with Kafka Event-Driven Architecture
// Wires all components with NestJS DI following Clean Architecture principles

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Presentation Layer
import { HealthController } from './controllers/health.controller';
import { InventoryResolver } from './inventory.resolver';

// Application Layer - Use Cases
import { CreateInventoryItemUseCase } from '../../application/use-cases/create-inventory-item.use-case';
import { GetInventoryItemUseCase } from '../../application/use-cases/get-inventory-item.use-case';
import { ReserveInventoryUseCase } from '../../application/use-cases/reserve-inventory.use-case';
import { ReleaseInventoryUseCase } from '../../application/use-cases/release-inventory.use-case';

// Domain Layer
import { InventoryDomainService } from '../../domain/services/inventory-domain.service';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';
import { IEventPublisher } from '../../application/ports/event-publisher.interface';

// Infrastructure Layer - Persistence
import { PrismaInventoryRepository } from '../../infrastructure/persistence/prisma-inventory.repository';
import { PrismaService } from '../prisma/prisma.service';

// Infrastructure Layer - Kafka Messaging
import { KafkaProducerAdapter } from '../../infrastructure/messaging/kafka-producer.adapter';
import { KafkaConsumerAdapter } from '../../infrastructure/messaging/kafka-consumer.adapter';
import { KafkaEventPublisherAdapter } from '../../infrastructure/events/kafka-event-publisher.adapter';
import { KafkaEventConsumerService } from '../../infrastructure/messaging/kafka-event-consumer.service';
import { OrderEventHandler } from '../../infrastructure/messaging/handlers/order-event.handler';
import {
  KafkaConfig,
  KAFKA_CONSUMER_GROUPS,
} from '../../infrastructure/messaging/kafka.config';

// Token constants for dependency injection
export const INVENTORY_REPOSITORY = 'IInventoryRepository';
export const EVENT_PUBLISHER = 'IEventPublisher';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [
    // Infrastructure - Prisma Service
    PrismaService,

    // Infrastructure - Kafka Configuration
    {
      provide: 'KAFKA_CONFIG',
      useFactory: (configService: ConfigService): KafkaConfig => ({
        clientId: configService.get('KAFKA_CLIENT_ID', 'inventory-service'),
        brokers: configService
          .get<string>(
            'KAFKA_BROKERS',
            'localhost:9092,localhost:9093,localhost:9094',
          )
          .split(','),
        connectionTimeout: 10000,
        requestTimeout: 30000,
        // Comma separated list of topics this service subscribes to
        subscribeTopics: configService
          .get<string>('KAFKA_SUBSCRIBE_TOPICS', 'order.events')
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        retry: {
          maxRetryTime: 30000,
          initialRetryTime: 300,
          retries: 8,
        },
      }),
      inject: [ConfigService],
    },

    // Infrastructure - Kafka Producer
    {
      provide: KafkaProducerAdapter,
      useFactory: (kafkaConfig: KafkaConfig) => {
        const producer = new KafkaProducerAdapter(kafkaConfig);
        // Connect immediately on initialization
        producer.connect().catch((err) => {
          console.error('Failed to connect Kafka Producer:', err);
        });
        return producer;
      },
      inject: ['KAFKA_CONFIG'],
    },

    // Infrastructure - Kafka Consumer
    {
      provide: KafkaConsumerAdapter,
      useFactory: (kafkaConfig: KafkaConfig) => {
        return new KafkaConsumerAdapter(
          kafkaConfig,
          KAFKA_CONSUMER_GROUPS.INVENTORY_SERVICE,
        );
      },
      inject: ['KAFKA_CONFIG'],
    },

    // Infrastructure Adapters - Bind interfaces to implementations
    {
      provide: INVENTORY_REPOSITORY,
      useClass: PrismaInventoryRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useClass: KafkaEventPublisherAdapter,
    },

    // Domain Services
    InventoryDomainService,

    // Application Use Cases - Factory pattern for dependency injection
    {
      provide: CreateInventoryItemUseCase,
      useFactory: (
        repository: IInventoryRepository,
        eventPublisher: IEventPublisher,
      ) => {
        return new CreateInventoryItemUseCase(repository, eventPublisher);
      },
      inject: [INVENTORY_REPOSITORY, EVENT_PUBLISHER],
    },
    {
      provide: GetInventoryItemUseCase,
      useFactory: (repository: IInventoryRepository) => {
        return new GetInventoryItemUseCase(repository);
      },
      inject: [INVENTORY_REPOSITORY],
    },
    {
      provide: ReserveInventoryUseCase,
      useFactory: (
        repository: IInventoryRepository,
        eventPublisher: IEventPublisher,
        domainService: InventoryDomainService,
      ) => {
        return new ReserveInventoryUseCase(
          repository,
          eventPublisher,
          domainService,
        );
      },
      inject: [INVENTORY_REPOSITORY, EVENT_PUBLISHER, InventoryDomainService],
    },
    {
      provide: ReleaseInventoryUseCase,
      useFactory: (
        repository: IInventoryRepository,
        eventPublisher: IEventPublisher,
      ) => {
        return new ReleaseInventoryUseCase(repository, eventPublisher);
      },
      inject: [INVENTORY_REPOSITORY, EVENT_PUBLISHER],
    },

    // Infrastructure - Event Handlers
    OrderEventHandler,

    // Infrastructure - Kafka Event Consumer Service (starts consuming on init)
    KafkaEventConsumerService,

    // Keep resolver for GraphQL (will be updated to use use cases)
    InventoryResolver,
  ],
  exports: [
    // Export use cases if other modules need them
    CreateInventoryItemUseCase,
    GetInventoryItemUseCase,
    ReserveInventoryUseCase,
    INVENTORY_REPOSITORY,
    EVENT_PUBLISHER,
  ],
})
export class InventoryModule {}
