import { DomainEvent } from './index';

export class RiskProfileConfiguredEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly maxDailyLoss: number,
    public readonly maxDrawdown: number,
    public readonly maxPositionSize: number,
    public readonly maxOpenPositions: number,
    public readonly marginThreshold: number,
    public readonly actorId: string,
  ) {
    super();
  }
}

export class RiskCalculatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly riskScore: number,
    public readonly decisionOutcome: string,
    public readonly correlationId: string,
  ) {
    super();
  }
}

export class RiskLimitReachedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly limitType: string,
    public readonly limitValue: number,
    public readonly actualValue: number,
  ) {
    super();
  }
}
