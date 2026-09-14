/* eslint-disable @typescript-eslint/no-explicit-any */
export abstract class BaseAggregateRoot {
  private readonly _uncommittedEvents: any[] = [];

  protected apply(event: any): void {
    this._uncommittedEvents.push(event);
  }

  public getUncommittedEvents(): any[] {
    return this._uncommittedEvents;
  }

  public commit(): void {
    this._uncommittedEvents.length = 0;
  }
}
