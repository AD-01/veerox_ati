import { DomainEvent } from '@veerox/events';

export abstract class BaseAggregateRoot {
  private _uncommittedEvents: DomainEvent[] = [];

  protected apply(event: DomainEvent): void {
    this._uncommittedEvents.push(event);
  }

  public getUncommittedEvents(): DomainEvent[] {
    return this._uncommittedEvents;
  }

  public commit(): void {
    this._uncommittedEvents = [];
  }
}
