import { DomainEvent } from '@veerox/events';

export interface IOutboxRepository {
  publishAll(events: DomainEvent[], tx?: any): Promise<void>;
}
