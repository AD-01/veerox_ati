export class StrategyRegisteredEvent {
  constructor(
    public readonly strategyId: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly version: string,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyStatusChangedEvent {
  constructor(
    public readonly strategyId: string,
    public readonly organizationId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly timestamp: Date,
  ) {}
}

export class ExpertAdvisorRegisteredEvent {
  constructor(
    public readonly expertAdvisorId: string,
    public readonly strategyId: string,
    public readonly organizationId: string,
    public readonly version: string,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyTransitionRecommendedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly currentStrategyId: string | null,
    public readonly recommendedStrategyId: string,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {}
}

export class PositionOpenedEvent {
  constructor(
    public readonly positionId: string,
    public readonly workspaceId: string,
    public readonly symbolId: string,
    public readonly strategyId: string | null,
    public readonly timestamp: Date,
  ) {}
}

export class PositionClosedEvent {
  constructor(
    public readonly positionId: string,
    public readonly workspaceId: string,
    public readonly timestamp: Date,
  ) {}
}

export class ExpertAdvisorStatusChangedEvent {
  constructor(
    public readonly expertAdvisorId: string,
    public readonly organizationId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyActivatedEvent {
  constructor(
    public readonly strategyId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyAssignedEvent {
  constructor(
    public readonly strategyId: string,
    public readonly workspaceId: string,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyEvaluationCompletedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly strategyId: string | null,
    public readonly marketSnapshotId: string,
    public readonly recommendedStrategyId: string | null,
    public readonly isDeterministic: boolean,
    public readonly timestamp: Date,
  ) {}
}

export class ExpertAdvisorAssignedEvent {
  constructor(
    public readonly expertAdvisorId: string,
    public readonly strategyId: string,
    public readonly workspaceId: string,
    public readonly timestamp: Date,
  ) {}
}

export class TradingOpportunityGeneratedEvent {
  constructor(
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly strategyId: string,
    public readonly expertAdvisorId: string | null,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly direction: 'LONG' | 'SHORT',
    public readonly size: number,
    public readonly stopLoss: number | null,
    public readonly takeProfit: number | null,
    public readonly timestamp: Date,
  ) {}
}

export class StrategyMetricsUpdatedEvent {
  constructor(
    public readonly strategyId: string,
    public readonly organizationId: string,
    public readonly confidenceScore: number,
    public readonly historicalPerformance: string,
    public readonly timestamp: Date,
  ) {}
}
