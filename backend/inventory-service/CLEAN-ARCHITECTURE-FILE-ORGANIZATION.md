# Clean Architecture - File Organization Guide

## Overview

This guide explains **where to place files** in Clean Architecture, answering the common question: **"Should DTOs and interfaces be in the domain folder?"**

## The Golden Rule: Dependency Direction

```
┌─────────────────────────────────────────────────────────┐
│                    Infrastructure                        │
│  (Framework-specific, external concerns)                 │
│  Depends on: Domain, Application                         │
└───────────────────┬─────────────────────────────────────┘
                    │ implements/adapts
                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Application                           │
│  (Use cases, orchestration)                              │
│  Depends on: Domain only                                 │
└───────────────────┬─────────────────────────────────────┘
                    │ uses
                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Domain                                │
│  (Business logic, NO external dependencies)              │
│  Depends on: NOTHING                                     │
└─────────────────────────────────────────────────────────┘
```

**Key Principle**: Dependencies point **INWARD**. Domain never depends on anything else.

## File Placement Rules

### ✅ Domain Layer (domain/)

**What BELONGS here:**

1. **Entities** - Core business objects with behavior

   ```typescript
   // domain/entities/inventory-item.entity.ts
   export class InventoryItem {
     reserveQuantity(amount: number): DomainEvent { ... }
   }
   ```

2. **Value Objects** - Immutable domain concepts

   ```typescript
   // domain/value-objects/price.vo.ts
   export class Price {
     constructor(
       readonly amount: number,
       readonly currency: Currency,
     ) {}
   }
   ```

3. **Domain Events** - Things that happened in the domain

   ```typescript
   // domain/events/inventory.events.ts
   export class InventoryItemReservedEvent extends DomainEvent { ... }
   ```

4. **Repository Interfaces (Ports)** - Contracts domain needs

   ```typescript
   // domain/repositories/inventory.repository.interface.ts
   export interface IInventoryRepository {
     findById(id: string): Promise<InventoryItem | null>;
     save(item: InventoryItem): Promise<void>;
   }
   ```

5. **Domain Services** - Multi-entity business logic

   ```typescript
   // domain/services/inventory-domain.service.ts
   export class InventoryDomainService {
     canReserveMultipleItems(...) { ... }
   }
   ```

6. **Domain-Specific Types/Enums**
   ```typescript
   // domain/types/inventory-status.enum.ts
   export enum InventoryStatus {
     AVAILABLE,
     RESERVED,
     OUT_OF_STOCK,
   }
   ```

**What DOES NOT belong here:**

- ❌ DTOs for API requests/responses
- ❌ Framework-specific decorators (@Injectable, @Column)
- ❌ Database models (Prisma models)
- ❌ HTTP/GraphQL input types
- ❌ Infrastructure interfaces (Kafka, Redis)

---

### ✅ Application Layer (application/)

**What BELONGS here:**

1. **Commands** - Write operations

   ```typescript
   // application/commands/create-inventory-item.command.ts
   export class CreateInventoryItemCommand {
     constructor(
       public readonly title: string,
       public readonly quantity: number,
     ) {}
   }
   ```

2. **Queries** - Read operations

   ```typescript
   // application/queries/get-inventory-item.query.ts
   export class GetInventoryItemQuery {
     constructor(public readonly id: string) {}
   }
   ```

3. **DTOs** - Data Transfer Objects for application responses

   ```typescript
   // application/dtos/inventory-item.dto.ts
   export class InventoryItemDto {
     id: string;
     title: string;
     quantity: number;

     static fromDomain(item: InventoryItem): InventoryItemDto { ... }
   }
   ```

4. **Port Interfaces** - Application needs (not domain needs)

   ```typescript
   // application/ports/event-publisher.interface.ts
   export interface IEventPublisher {
     publish(event: DomainEvent): Promise<void>;
   }
   ```

5. **Use Cases** - Application orchestration
   ```typescript
   // application/use-cases/create-inventory-item.use-case.ts
   export class CreateInventoryItemUseCase {
     execute(command: CreateInventoryItemCommand): Promise<InventoryItemDto> { ... }
   }
   ```

**Why Commands/Queries/DTOs go here:**

- They represent application-level concerns
- They translate between domain and external world
- They can have validation decorators (class-validator)
- They're not core business concepts

---

### ✅ Infrastructure Layer (infrastructure/)

**What BELONGS here:**

1. **Repository Implementations**

   ```typescript
   // infrastructure/persistence/prisma-inventory.repository.ts
   export class PrismaInventoryRepository implements IInventoryRepository {
     constructor(private prisma: PrismaService) {}
     // Prisma-specific code here
   }
   ```

2. **Event Publisher Implementations**

   ```typescript
   // infrastructure/events/kafka-event-publisher.adapter.ts
   export class KafkaEventPublisherAdapter implements IEventPublisher {
     constructor(private kafka: KafkaProducerAdapter) {}
   }
   ```

3. **Messaging/Queue Infrastructure**

   ```typescript
   // infrastructure/messaging/kafka-producer.adapter.ts
   // infrastructure/messaging/kafka-consumer.adapter.ts
   // infrastructure/messaging/handlers/order-event.handler.ts
   ```

4. **External Service Clients**

   ```typescript
   // infrastructure/clients/payment-service.client.ts
   // infrastructure/clients/notification-service.client.ts
   ```

5. **Mappers** - Convert between domain and persistence models
   ```typescript
   // infrastructure/persistence/mappers/inventory-item.mapper.ts
   ```

**Key principle**: Infrastructure depends on domain (implements interfaces), never the reverse.

---

### ✅ Presentation Layer (src/)

**What BELONGS here:**

1. **Controllers** - HTTP/REST endpoints

   ```typescript
   // src/inventory/controllers/inventory.controller.ts
   @Controller('inventory')
   export class InventoryController {
     constructor(private useCase: CreateInventoryItemUseCase) {}
   }
   ```

2. **GraphQL Resolvers** - GraphQL endpoints

   ```typescript
   // src/inventory/inventory.resolver.ts
   @Resolver()
   export class InventoryResolver {
     constructor(private useCase: GetInventoryItemUseCase) {}
   }
   ```

3. **GraphQL Input Types** - Presentation DTOs

   ```typescript
   // Inside resolver file or separate file
   @InputType()
   class CreateInventoryInput {
     @Field() title: string;
   }
   ```

4. **NestJS Modules** - Dependency injection configuration

   ```typescript
   // src/inventory/inventory.module.ts
   @Module({
     providers: [
       { provide: 'IInventoryRepository', useClass: PrismaInventoryRepository },
       CreateInventoryItemUseCase,
     ],
   })
   ```

5. **Supporting Infrastructure** - Framework concerns
   ```typescript
   // src/auth/ - Authentication
   // src/common/ - Shared utilities
   // src/graphql/ - GraphQL scalars
   // src/interceptors/ - NestJS interceptors
   // src/prisma/ - Prisma service
   ```

---

## Common Questions Answered

### Q: "Should DTOs be in domain folder?"

**A: It depends on the type of DTO:**

- **Application DTOs** (API responses) → `application/dtos/` ✅
- **GraphQL Input Types** (presentation) → Inside resolvers in `src/` ✅
- **Domain Value Objects** → `domain/value-objects/` ✅

**Example**:

```
domain/value-objects/price.vo.ts        # Domain concept (immutable, with behavior)
application/dtos/inventory-item.dto.ts  # Application response DTO
src/inventory/inventory.resolver.ts     # Contains @InputType for GraphQL
```

### Q: "Should interfaces be in domain folder?"

**A: It depends on WHO needs the interface:**

- **Repository interfaces** (domain needs persistence) → `domain/repositories/` ✅
- **Event publisher interface** (application needs to publish) → `application/ports/` ✅
- **External service interfaces** (infrastructure) → `infrastructure/clients/` ✅

**Ports and Adapters Pattern**:

- **Port** (interface) = What you need → Goes in the layer that needs it
- **Adapter** (implementation) = How you fulfill it → Goes in infrastructure

### Q: "Where do validation decorators go?"

**A: In the layer that needs them:**

- **Application commands** can use `class-validator` decorators
- **Domain entities** use pure validation methods (no decorators)
- **Presentation inputs** use GraphQL decorators (@Field, @InputType)

**Example**:

```typescript
// application/commands/create-inventory-item.command.ts
import { IsString, IsNumber, Min } from 'class-validator';

export class CreateInventoryItemCommand {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}
```

### Q: "Can domain import from application?"

**A: NO! Never!**

Domain must have **zero dependencies**. It's the innermost layer.

❌ **WRONG**:

```typescript
// domain/entities/inventory-item.entity.ts
import { CreateInventoryItemCommand } from '../../application/commands/...'; // NO!
```

✅ **CORRECT**:

```typescript
// application/use-cases/create-inventory-item.use-case.ts
import { InventoryItem } from '../../domain/entities/inventory-item.entity'; // YES!
```

### Q: "Where do Prisma models go?"

**A: Prisma models stay in their schema file:**

```
src/prisma/schema.prisma  # Database schema (infrastructure concern)
```

**Mapping happens in infrastructure**:

```typescript
// infrastructure/persistence/prisma-inventory.repository.ts
private toDomain(prismaModel: any): InventoryItem {
  return InventoryItem.reconstitute({ ... });
}

private toPrisma(entity: InventoryItem): any {
  return { id: entity.id, title: entity.title, ... };
}
```

---

## Current Project Structure

```
backend/inventory-service/
├── domain/                              # Pure business logic
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── repositories/                    # Interfaces (ports)
│   └── services/
│
├── application/                         # Use cases & orchestration
│   ├── commands/                        # Write operations
│   ├── queries/                         # Read operations
│   ├── dtos/                           # Application response DTOs
│   ├── ports/                          # Application needs (interfaces)
│   └── use-cases/
│
├── infrastructure/                      # Framework & external concerns
│   ├── persistence/
│   │   └── prisma-inventory.repository.ts
│   ├── events/
│   │   └── kafka-event-publisher.adapter.ts
│   └── messaging/
│       ├── kafka-producer.adapter.ts
│       ├── kafka-consumer.adapter.ts
│       └── handlers/
│
└── src/                                # Presentation & infrastructure
    ├── inventory/
    │   ├── controllers/                # REST endpoints
    │   ├── inventory.resolver.ts       # GraphQL endpoints
    │   └── inventory.module.ts         # DI configuration
    ├── auth/                           # Authentication (infrastructure)
    ├── common/                         # Shared utilities (infrastructure)
    ├── graphql/                        # GraphQL scalars (infrastructure)
    ├── interceptors/                   # NestJS interceptors (infrastructure)
    ├── prisma/                         # Prisma service (infrastructure)
    ├── app.module.ts                   # Root module
    └── main.ts                         # Application entry point
```

---

## Testing by Layer

### Domain Tests (Pure Logic)

```typescript
// No framework, no database, just logic
describe('InventoryItem', () => {
  it('should reserve quantity', () => {
    const item = InventoryItem.create({...});
    item.reserveQuantity(5);
    expect(item.quantity).toBe(5);
  });
});
```

### Application Tests (Use Cases with Mocks)

```typescript
describe('CreateInventoryItemUseCase', () => {
  it('should create item', async () => {
    const mockRepo = { save: jest.fn() };
    const useCase = new CreateInventoryItemUseCase(mockRepo, mockPublisher);
    await useCase.execute(command);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

### Infrastructure Tests (Integration)

```typescript
describe('PrismaInventoryRepository', () => {
  it('should save to database', async () => {
    const repo = new PrismaInventoryRepository(prisma);
    await repo.save(item);
    const found = await prisma.inventory.findUnique({...});
    expect(found).toBeDefined();
  });
});
```

### Presentation Tests (E2E)

```typescript
describe('Inventory API', () => {
  it('POST /inventory should create', async () => {
    const response = await request(app).post('/inventory').send({...});
    expect(response.status).toBe(201);
  });
});
```

---

## Summary

| File Type                      | Location                                        | Why                      |
| ------------------------------ | ----------------------------------------------- | ------------------------ |
| Entities, Value Objects        | `domain/`                                       | Core business concepts   |
| Repository Interfaces          | `domain/repositories/`                          | Domain needs persistence |
| Domain Events                  | `domain/events/`                                | Domain occurrences       |
| Commands, Queries              | `application/commands/`, `application/queries/` | Application messages     |
| Application DTOs               | `application/dtos/`                             | Response formatting      |
| Event Publisher Interface      | `application/ports/`                            | Application needs events |
| Use Cases                      | `application/use-cases/`                        | Orchestration logic      |
| Repository Implementations     | `infrastructure/persistence/`                   | Adapts persistence       |
| Event Publisher Implementation | `infrastructure/events/`                        | Adapts Kafka             |
| Kafka Adapters                 | `infrastructure/messaging/`                     | Messaging infrastructure |
| Controllers                    | `src/inventory/controllers/`                    | HTTP presentation        |
| Resolvers                      | `src/inventory/`                                | GraphQL presentation     |
| GraphQL Inputs                 | Inside resolvers                                | Presentation DTOs        |
| Modules                        | `src/inventory/`                                | DI configuration         |

**Remember**: When in doubt, ask "Who needs this?" and "Does it depend on external frameworks?" The answer tells you which layer it belongs to.

---

**The essence of Clean Architecture**: Keep business logic pure and isolated, adapt external concerns at the edges, and always point dependencies inward.
