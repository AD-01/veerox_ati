import { DomainEvent } from './index';

export class SignalOrchestratedEvent extends DomainEvent {
  constructor(
    public readonly signalId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly symbolId: string,
    public readonly source: string,
    public readonly sourceId: string,
    public readonly direction: string,
    public readonly size: number | null,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class SignalConflictDetectedEvent extends DomainEvent {
  constructor(
    public readonly symbolId: string,
    public readonly timeWindow: Date,
    public readonly conflicts: any[],
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}
