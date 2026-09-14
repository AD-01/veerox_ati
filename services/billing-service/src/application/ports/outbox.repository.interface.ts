/* eslint-disable @typescript-eslint/no-explicit-any */
import { DomainEvent } from '@veerox/events';

export interface IOutboxRepository {
  publish(event: DomainEvent, tx?: any): Promise<void>;
  publishAll(events: DomainEvent[], tx?: any): Promise<void>;
}
