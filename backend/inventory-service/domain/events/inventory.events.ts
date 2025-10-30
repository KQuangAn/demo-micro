// Domain Events
// Represent things that have happened in the domain

export interface DomainEvent {
  readonly occurredOn: Date;
  readonly aggregateId: string;
}

export class InventoryItemCreatedEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly brand: string,
    public readonly quantity: number,
  ) {
    this.occurredOn = new Date();
  }
}

export class InventoryItemUpdatedEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly changes: Record<string, any>,
  ) {
    this.occurredOn = new Date();
  }
}

export class InventoryItemDeletedEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(public readonly aggregateId: string) {
    this.occurredOn = new Date();
  }
}

export class InventoryReservedEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly quantity: number,
    public readonly userId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class InventoryReleasedEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly quantity: number,
    public readonly reason: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class InsufficientInventoryEvent implements DomainEvent {
  readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly requestedQuantity: number,
    public readonly availableQuantity: number,
  ) {
    this.occurredOn = new Date();
  }
}
