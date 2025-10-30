# Event-Driven Architecture with Kafka

## Overview

The Inventory Service now follows a fully **event-driven architecture** using **Apache Kafka** for asynchronous communication between microservices. This architecture enables:

- **Loose coupling** between services
- **Scalability** through asynchronous processing
- **Resilience** with message persistence and replay
- **Event sourcing** capabilities
- **CQRS** (Command Query Responsibility Segregation)

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Cluster                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Topics:                                              │  │
│  │  - inventory.created                                  │  │
│  │  - inventory.updated                                  │  │
│  │  - inventory.deleted                                  │  │
│  │  - inventory.reserved                                 │  │
│  │  - inventory.released                                 │  │
│  │  - inventory.reservation.failed                       │  │
│  │  - inventory.insufficient                             │  │
│  │  - order.created (from Order Service)                 │  │
│  │  - order.cancelled (from Order Service)               │  │
│  │  - order.updated (from Order Service)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    ▲                    │
         Publish    │                    │  Subscribe
                    │                    ▼
┌───────────────────┴─────────────────────────────────────────┐
│              Inventory Service                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Kafka Producer (KafkaEventPublisherAdapter)        │   │
│  │  • Publishes domain events to Kafka topics          │   │
│  │  • Implements IEventPublisher port                  │   │
│  │  • Batching and retry logic                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Kafka Consumer (KafkaConsumerAdapter)              │   │
│  │  • Subscribes to order topics                       │   │
│  │  • Consumer group: inventory-service-group          │   │
│  │  • Routes events to handlers                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Event Handlers (OrderEventHandler)                 │   │
│  │  • Handles OrderCreated → Reserve Inventory         │   │
│  │  • Handles OrderCancelled → Release Inventory       │   │
│  │  • Triggers use cases                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Kafka Topics

### Outbound Events (Published by Inventory Service)

| Topic                          | Event Type                 | Description                  | Payload                                                    |
| ------------------------------ | -------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `inventory.created`            | InventoryItemCreatedEvent  | New inventory item created   | `{ aggregateId, title, brand, quantity, price, currency }` |
| `inventory.updated`            | InventoryItemUpdatedEvent  | Inventory item updated       | `{ aggregateId, title, brand, quantity }`                  |
| `inventory.deleted`            | InventoryItemDeletedEvent  | Inventory item deleted       | `{ aggregateId }`                                          |
| `inventory.reserved`           | InventoryItemReservedEvent | Inventory reserved for order | `{ aggregateId, quantity, orderId, userId }`               |
| `inventory.released`           | InventoryItemReleasedEvent | Inventory released back      | `{ aggregateId, quantity, orderId }`                       |
| `inventory.reservation.failed` | -                          | Reservation failed           | `{ aggregateId, reason }`                                  |
| `inventory.insufficient`       | InsufficientInventoryEvent | Not enough stock             | `{ aggregateId, requested, available }`                    |

### Inbound Events (Consumed from Other Services)

| Topic             | Event Type          | Source Service | Handler                                    |
| ----------------- | ------------------- | -------------- | ------------------------------------------ |
| `order.created`   | OrderCreatedEvent   | Order Service  | `OrderEventHandler.handleOrderCreated()`   |
| `order.cancelled` | OrderCancelledEvent | Order Service  | `OrderEventHandler.handleOrderCancelled()` |
| `order.updated`   | OrderUpdatedEvent   | Order Service  | `OrderEventHandler.handleOrderUpdated()`   |

## Consumer Groups

- **Group ID**: `inventory-service-group`
- **Purpose**: Ensures only one instance of inventory service processes each event (load balancing)
- **Partition Strategy**: Key-based partitioning by `productId` for order processing

## Event Flow Examples

### 1. Create Inventory Item

```
Client Request (REST/GraphQL)
     ↓
InventoryController.create()
     ↓
CreateInventoryItemUseCase.execute()
     ↓ (creates entity, saves to DB)
KafkaEventPublisherAdapter.publish()
     ↓
Kafka Topic: inventory.created
     ↓
[Order Service, Analytics Service, etc. consume event]
```

### 2. Reserve Inventory (Order Created)

```
Order Service creates order
     ↓
Publishes: OrderCreatedEvent → order.created topic
     ↓
Kafka Consumer (Inventory Service)
     ↓
OrderEventHandler.handleOrderCreated()
     ↓
ReserveInventoryUseCase.execute()
     ↓ (validates stock, reserves, saves)
KafkaEventPublisherAdapter.publish()
     ↓
Kafka Topic: inventory.reserved
     ↓
[Order Service confirms reservation]
```

### 3. Release Inventory (Order Cancelled)

```
Order Service cancels order
     ↓
Publishes: OrderCancelledEvent → order.cancelled topic
     ↓
Kafka Consumer (Inventory Service)
     ↓
OrderEventHandler.handleOrderCancelled()
     ↓
ReleaseInventoryUseCase.execute()
     ↓ (releases reserved quantity)
KafkaEventPublisherAdapter.publish()
     ↓
Kafka Topic: inventory.released
     ↓
[Order Service acknowledges release]
```

## Message Format

All Kafka messages follow a standard envelope format:

```typescript
interface KafkaMessage<T> {
  eventId: string; // Unique event identifier (UUID)
  eventType: string; // Event type name (e.g., "InventoryItemCreatedEvent")
  timestamp: Date; // When event occurred
  payload: T; // Actual event data
  metadata?: {
    userId?: string; // User who triggered the event
    correlationId?: string; // For tracing across services
    causationId?: string; // Event that caused this event
  };
}
```

### Example Message

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "InventoryItemReservedEvent",
  "timestamp": "2025-10-30T10:15:30.000Z",
  "payload": {
    "aggregateId": "inv-123",
    "quantity": 5,
    "orderId": "order-456",
    "userId": "user-789"
  },
  "metadata": {
    "correlationId": "660e8400-e29b-41d4-a716-446655440001",
    "userId": "user-789"
  }
}
```

## Infrastructure Components

### 1. KafkaProducerAdapter

**Location**: `infrastructure/messaging/kafka-producer.adapter.ts`

**Responsibilities**:

- Connects to Kafka cluster
- Publishes messages to topics
- Batch publishing support
- Retry logic and error handling
- Connection lifecycle management

**Configuration**:

```typescript
{
  clientId: 'inventory-service',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    maxRetryTime: 30000,
    initialRetryTime: 300,
    retries: 8
  }
}
```

### 2. KafkaConsumerAdapter

**Location**: `infrastructure/messaging/kafka-consumer.adapter.ts`

**Responsibilities**:

- Subscribes to topics
- Consumes messages
- Routes messages to handlers
- Offset management
- Error handling and DLQ (future)

**Features**:

- Consumer group management
- Automatic reconnection
- Message handler registration
- Graceful shutdown

### 3. KafkaEventPublisherAdapter

**Location**: `infrastructure/events/kafka-event-publisher.adapter.ts`

**Responsibilities**:

- Implements `IEventPublisher` domain port
- Converts domain events to Kafka messages
- Maps events to appropriate topics
- Batch publishing for multiple events

**Domain Event Mapping**:

```typescript
InventoryItemCreatedEvent  → inventory.created
InventoryItemUpdatedEvent  → inventory.updated
InventoryItemDeletedEvent  → inventory.deleted
InventoryItemReservedEvent → inventory.reserved
InventoryItemReleasedEvent → inventory.released
InsufficientInventoryEvent → inventory.insufficient
```

### 4. OrderEventHandler

**Location**: `infrastructure/messaging/handlers/order-event.handler.ts`

**Responsibilities**:

- Handles inbound order events
- Triggers appropriate use cases
- Error handling and logging

**Methods**:

- `handleOrderCreated()` - Reserves inventory
- `handleOrderCancelled()` - Releases inventory
- `handleOrderUpdated()` - Adjusts inventory

### 5. KafkaEventConsumerService

**Location**: `infrastructure/messaging/kafka-event-consumer.service.ts`

**Responsibilities**:

- Registers all event handlers
- Subscribes to topics
- Starts consuming messages
- Lifecycle management

## Configuration

### Environment Variables

```bash
# Kafka Configuration
KAFKA_CLIENT_ID=inventory-service
KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094

# Optional Advanced Settings
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_RETRY_MAX_TIME=30000
KAFKA_RETRY_INITIAL_TIME=300
KAFKA_RETRY_COUNT=8
```

### NestJS Module Configuration

See `src/inventory/inventory.module.ts` for full DI configuration.

Key providers:

- `KAFKA_CONFIG` - Kafka connection config from env vars
- `KafkaProducerAdapter` - Producer instance
- `KafkaConsumerAdapter` - Consumer instance
- `EVENT_PUBLISHER` - Bound to KafkaEventPublisherAdapter
- `OrderEventHandler` - Order event handler
- `KafkaEventConsumerService` - Consumer service (auto-starts)

## Testing Strategy

### Unit Tests

Test domain events and handlers in isolation:

```typescript
describe('OrderEventHandler', () => {
  it('should reserve inventory on OrderCreated', async () => {
    const mockUseCase = { execute: jest.fn() };
    const handler = new OrderEventHandler(mockUseCase);

    const event: KafkaMessage<OrderCreatedPayload> = {...};
    await handler.handleOrderCreated(event);

    expect(mockUseCase.execute).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test Kafka integration with test containers:

```typescript
describe('Kafka Integration', () => {
  let kafka: Kafka;

  beforeAll(async () => {
    // Start Kafka test container
    kafka = await startKafkaTestContainer();
  });

  it('should publish and consume events', async () => {
    // Publish event
    await producer.publish('test-topic', event);

    // Assert consumer received it
    await waitFor(() => expect(handler).toHaveBeenCalled());
  });
});
```

## Error Handling

### Producer Errors

- Automatic retry with exponential backoff
- Logs errors for monitoring
- Throws exception if all retries fail

### Consumer Errors

- Logs error details
- Does not commit offset (message will be reprocessed)
- Future: Implement Dead Letter Queue (DLQ)

### Recommended Pattern

```typescript
try {
  await useCase.execute(command);
  // Success - offset will be committed
} catch (error) {
  logger.error('Failed to process event', error);
  // Error - offset not committed, message reprocessed
  // Consider DLQ after N retries
  throw error;
}
```

## Monitoring and Observability

### Key Metrics to Monitor

1. **Producer**:

   - Message publish rate
   - Publish latency
   - Failed publish count
   - Retry count

2. **Consumer**:

   - Message consumption rate
   - Processing latency
   - Consumer lag (offset behind)
   - Failed message count

3. **Business**:
   - Inventory reserved count
   - Reservation failures
   - Insufficient stock events

### Logging

All components include structured logging:

```typescript
logger.log('Published event to Kafka', {
  eventType: 'InventoryItemCreatedEvent',
  topic: 'inventory.created',
  eventId: '...',
  partition: 0,
  offset: 12345,
});
```

## Deployment Considerations

### Kafka Cluster Setup

- **3 brokers** minimum for production
- **Replication factor**: 3
- **Min in-sync replicas**: 2
- **Topic partitions**: Based on throughput (start with 3)

### Scaling

- **Horizontal scaling**: Add more service instances
- **Consumer instances** = Number of partitions (max)
- **Load balancing**: Handled by consumer group

### High Availability

- Multiple Kafka brokers
- Replication across brokers
- Consumer group rebalancing
- Idempotent producers

## Future Enhancements

1. **Dead Letter Queue (DLQ)**

   - Route failed messages after N retries
   - Manual inspection and replay

2. **Event Sourcing**

   - Store all events in event store
   - Replay events to rebuild state

3. **Saga Pattern**

   - Distributed transactions across services
   - Compensating transactions

4. **Schema Registry**

   - Avro/Protobuf schemas
   - Schema evolution and compatibility

5. **Transactional Outbox**
   - Atomic database + Kafka writes
   - Guaranteed event publishing

## References

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [KafkaJS Library](https://kafka.js.org/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**Summary**: The Inventory Service now implements a fully event-driven architecture using Kafka for asynchronous, scalable, and resilient microservice communication. Events flow through well-defined topics, handlers trigger use cases, and the Clean Architecture ensures maintainability and testability.
