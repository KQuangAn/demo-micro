# Inventory Service - Clean Architecture Refactor

## Overview

This document explains the Clean Architecture (Onion Architecture) refactoring of the inventory service. The architecture follows the **Dependency Rule**: dependencies point inward, with the domain at the center and infrastructure at the edges.

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│          Presentation Layer (Controllers)           │
│                (src/inventory/)                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│         Application Layer (Use Cases)                │
│            (application/)                            │
│  • Commands, Queries, DTOs                           │
│  • Use Cases orchestrate domain logic                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│           Domain Layer (Business Logic)              │
│               (domain/)                              │
│  • Entities, Value Objects, Events                   │
│  • Domain Services                                   │
│  • Repository Interfaces (Ports)                     │
└─────────────────────────────────────────────────────┘
                     ▲
                     │
┌────────────────────┴────────────────────────────────┐
│      Infrastructure Layer (Adapters)                 │
│           (infrastructure/)                          │
│  • Prisma Repository Implementation                  │
│  • Event Publisher Adapter                           │
│  • External Service Clients                          │
└─────────────────────────────────────────────────────┘
```

## Project Structure

```
backend/inventory-service/
├── domain/                           # Core business logic (no dependencies)
│   ├── entities/
│   │   └── inventory-item.entity.ts  # Core entity with business rules
│   ├── value-objects/
│   │   └── price.vo.ts               # Price and Currency VOs
│   ├── events/
│   │   └── inventory.events.ts       # Domain events
│   ├── repositories/
│   │   └── inventory.repository.interface.ts  # Repository port
│   └── services/
│       └── inventory-domain.service.ts        # Domain service
│
├── application/                      # Use cases (depends on domain only)
│   ├── commands/
│   │   ├── create-inventory-item.command.ts
│   │   └── reserve-inventory.command.ts
│   ├── queries/
│   │   └── get-inventory-item.query.ts
│   ├── dtos/
│   │   └── inventory-item.dto.ts
│   ├── ports/
│   │   └── event-publisher.interface.ts
│   └── use-cases/
│       ├── create-inventory-item.use-case.ts
│       ├── get-inventory-item.use-case.ts
│       └── reserve-inventory.use-case.ts
│
├── infrastructure/                   # Adapters (depends on domain)
│   ├── persistence/
│   │   └── prisma-inventory.repository.ts
│   └── events/
│       └── nest-event-publisher.adapter.ts
│
└── src/                             # Presentation layer (depends on application)
    └── inventory/
        ├── controllers/
        │   └── inventory.controller.ts
        ├── inventory.resolver.ts    # GraphQL resolver
        └── inventory.module.ts      # NestJS DI configuration
```

## Key Concepts

### 1. Domain Layer (Core)

The innermost layer containing pure business logic with **no external dependencies**.

#### Entities

- **InventoryItem**: Core business entity
  - Factory methods: `create()`, `reconstitute()`
  - Business logic: `reserveQuantity()`, `releaseQuantity()`, `updateDetails()`
  - Validation rules embedded in entity
  - Immutable getters for data access

#### Value Objects

- **Price**: Immutable value object with amount validation
- **Currency**: Code, name, symbol (e.g., USD, $)
- Value objects use `equals()` method for comparison

#### Domain Events

- `InventoryItemCreatedEvent`
- `InventoryItemUpdatedEvent`
- `InventoryItemReservedEvent`
- `InsufficientInventoryEvent`

#### Repository Interfaces (Ports)

```typescript
// Define contracts, implementations in infrastructure layer
interface IInventoryRepository {
  findById(id: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  delete(id: string): Promise<void>;
}
```

#### Domain Services

- **InventoryDomainService**: Multi-entity business logic
  - `canReserveMultipleItems()`: Validate stock across items
  - `reserveMultipleItems()`: Coordinate reservations
  - `calculateTotalValue()`: Compute inventory worth

### 2. Application Layer (Use Cases)

Orchestrates domain objects to fulfill use cases. Depends **only on domain layer**.

#### Commands (Write Operations)

```typescript
class CreateInventoryItemCommand {
  constructor(
    public readonly title: string,
    public readonly brand: string,
    // ... other properties
  ) {}
}
```

#### Queries (Read Operations)

```typescript
class GetInventoryItemQuery {
  constructor(public readonly itemId: string) {}
}
```

#### DTOs (Data Transfer Objects)

- **InventoryItemDto**: Serializable representation for API responses
- Static factory method: `fromDomain(entity: InventoryItem)`

#### Use Cases

```typescript
// Example: Create Inventory Item Use Case
class CreateInventoryItemUseCase {
  constructor(
    private repository: IInventoryRepository,
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateInventoryItemCommand): Promise<InventoryItemDto> {
    // 1. Create domain objects
    const currency = Currency.create(command.currencyCode, ...);
    const price = Price.create(command.price, currency);
    const item = InventoryItem.create({ ... });

    // 2. Persist
    await this.repository.save(item);
    await this.repository.savePrice(item.id, price);

    // 3. Publish events
    await this.eventPublisher.publish(new InventoryItemCreatedEvent(item));

    // 4. Return DTO
    return InventoryItemDto.fromDomain(item);
  }
}
```

### 3. Infrastructure Layer (Adapters)

Implements domain ports and adapts external frameworks.

#### Prisma Repository Adapter

```typescript
@Injectable()
class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private prisma: PrismaService) {}

  async save(item: InventoryItem): Promise<void> {
    const data = this.toPrisma(item); // Map domain to Prisma
    await this.prisma.inventory.upsert({...});
  }

  private toDomain(data: any): InventoryItem {
    return InventoryItem.reconstitute({...});
  }

  private toPrisma(item: InventoryItem): any {
    return { id: item.id, title: item.title, ... };
  }
}
```

#### Event Publisher Adapter

```typescript
@Injectable()
class NestEventPublisherAdapter implements IEventPublisher {
  constructor(private eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.eventEmitter.emitAsync(event.constructor.name, event);
  }
}
```

### 4. Presentation Layer (API)

Handles HTTP/GraphQL requests and delegates to use cases.

#### REST Controller

```typescript
@Controller('inventory')
class InventoryController {
  constructor(
    private createUseCase: CreateInventoryItemUseCase,
    private getUseCase: GetInventoryItemUseCase,
  ) {}

  @Post()
  async create(@Body() request: CreateRequest): Promise<InventoryItemDto> {
    const command = new CreateInventoryItemCommand(...);
    return await this.createUseCase.execute(command);
  }
}
```

## Dependency Injection with NestJS

```typescript
@Module({
  providers: [
    // Bind interface to implementation
    {
      provide: 'IInventoryRepository',
      useClass: PrismaInventoryRepository,
    },
    {
      provide: 'IEventPublisher',
      useClass: NestEventPublisherAdapter,
    },

    // Use cases with factory pattern
    {
      provide: CreateInventoryItemUseCase,
      useFactory: (repository, eventPublisher) => {
        return new CreateInventoryItemUseCase(repository, eventPublisher);
      },
      inject: ['IInventoryRepository', 'IEventPublisher'],
    },
  ],
})
export class InventoryModule {}
```

## Benefits of This Architecture

### 1. **Testability**

- Domain logic isolated from frameworks
- Use cases can be tested with mock repositories
- No need for database in unit tests

```typescript
// Unit test example
const mockRepo = { save: jest.fn(), findById: jest.fn() };
const mockPublisher = { publish: jest.fn() };
const useCase = new CreateInventoryItemUseCase(mockRepo, mockPublisher);
```

### 2. **Independence**

- Domain doesn't know about Prisma, NestJS, or GraphQL
- Can swap Prisma for TypeORM without touching domain
- Can add REST/gRPC without changing business logic

### 3. **Maintainability**

- Clear separation of concerns
- Business rules centralized in entities
- Easy to find and modify specific functionality

### 4. **Flexibility**

- Multiple entry points (REST, GraphQL, gRPC, CLI)
- Multiple persistence strategies (Prisma, Mongo, in-memory)
- Easy to add new use cases

## Flow Example: Creating an Inventory Item

```
1. Client Request
   POST /inventory
   { title: "...", brand: "...", ... }
            ↓
2. Controller (Presentation)
   InventoryController.create()
   - Validates request
   - Creates command
            ↓
3. Use Case (Application)
   CreateInventoryItemUseCase.execute()
   - Creates domain entities
   - Coordinates repository and events
            ↓
4. Repository (Infrastructure)
   PrismaInventoryRepository.save()
   - Maps domain to Prisma model
   - Persists to database
            ↓
5. Event Publisher (Infrastructure)
   NestEventPublisherAdapter.publish()
   - Emits InventoryItemCreatedEvent
            ↓
6. Response
   Returns InventoryItemDto to client
```

## Testing Strategy

### Unit Tests (Domain Layer)

```typescript
describe('InventoryItem', () => {
  it('should reserve quantity when sufficient stock', () => {
    const item = InventoryItem.create({ quantity: 10, ... });
    const event = item.reserveQuantity(5);

    expect(item.quantity).toBe(5);
    expect(event).toBeInstanceOf(InventoryItemReservedEvent);
  });
});
```

### Integration Tests (Use Cases)

```typescript
describe('CreateInventoryItemUseCase', () => {
  it('should create item and publish event', async () => {
    const mockRepo = createMockRepository();
    const mockPublisher = createMockPublisher();
    const useCase = new CreateInventoryItemUseCase(mockRepo, mockPublisher);

    const result = await useCase.execute(command);

    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockPublisher.publish).toHaveBeenCalled();
  });
});
```

### E2E Tests (API)

```typescript
describe('Inventory API', () => {
  it('POST /inventory should create item', async () => {
    const response = await request(app)
      .post('/inventory')
      .send({ title: 'Test', ... });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});
```

## Migration Notes

### Before (Anemic Service Pattern)

- InventoryService with all logic
- Direct Prisma calls in service
- Business rules scattered
- Hard to test

### After (Clean Architecture)

- Rich domain entities with business rules
- Repository abstracts persistence
- Use cases orchestrate operations
- Easy to test each layer independently

## Next Steps

1. **Install Dependencies**

   ```bash
   npm install @nestjs/event-emitter
   ```

2. **Run Tests**

   ```bash
   npm run test        # Unit tests
   npm run test:e2e    # Integration tests
   ```

3. **Update GraphQL Resolver**

   - Adapt existing resolver to use new use cases
   - Follow same pattern as REST controller

4. **Add Event Handlers**

   - Create handlers for domain events
   - Send notifications, update read models, etc.

5. **Implement Remaining Use Cases**
   - UpdateInventoryItemUseCase
   - DeleteInventoryItemUseCase
   - ReleaseInventoryUseCase

## References

- Clean Architecture by Robert C. Martin
- Domain-Driven Design by Eric Evans
- Implementing Domain-Driven Design by Vaughn Vernon
- NestJS Documentation: https://docs.nestjs.com/

---

**Summary**: This refactor transforms the inventory service from an anemic service pattern to a robust Clean Architecture implementation with clear layer separation, proper dependency direction, and high testability. The domain layer is now the heart of the application, containing all business rules and being independent of any framework or infrastructure concerns.
