export abstract class AggregateRoot {
  private readonly _domainEvents: unknown[] = [];

  get domainEvents(): unknown[] {
    return this._domainEvents;
  }

  protected apply(event: unknown): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents.length = 0;
  }
}
