// Port (Interface) for Event Publishing
// Application layer defines what it needs, infrastructure implements it

import { DomainEvent } from '../../domain/events/inventory.events';

export interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
