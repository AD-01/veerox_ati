import { DomainEvent } from './index';

export class DecisionGeneratedEvent extends DomainEvent {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly outcome: string,
    public readonly confidenceScore: number,
    public readonly status: string,
    public readonly explanation: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class DecisionApprovedEvent extends DomainEvent {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly outcome: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class DecisionRejectedEvent extends DomainEvent {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}
