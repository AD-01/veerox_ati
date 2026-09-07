import { DomainEvent } from './index';

export enum AIExecutionMode {
  SIGNAL_ONLY = 'SIGNAL_ONLY',
  AI_EXECUTE = 'AI_EXECUTE',
  HYBRID = 'HYBRID',
}

export enum AIRecommendationStatus {
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  EXECUTION_REQUESTED = 'EXECUTION_REQUESTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class AIRecommendationGeneratedEvent extends DomainEvent {
  public static readonly EVENT_NAME = 'ai.recommendation.generated';
  
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly recommendationId: string,
    public readonly modelId: string,
    public readonly modelVersion: string,
    public readonly symbolId: string,
    public readonly executionMode: string,
    public readonly recommendationType: string,
    public readonly confidence: number,
    public readonly strategyId?: string,
    public readonly marketRegime?: string,
    public readonly suggestedSide?: string,
    public readonly suggestedSize?: number,
    public readonly suggestedEntry?: number,
    public readonly suggestedStopLoss?: number,
    public readonly suggestedTakeProfit?: number,
    public readonly reasoning?: string,
    public readonly supportingSignals?: any
  ) {
    super();
  }
}

export class AIRecommendationRejectedEvent extends DomainEvent {
  public static readonly EVENT_NAME = 'ai.recommendation.rejected';
  
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly recommendationId: string,
    public readonly reason: string
  ) {
    super();
  }
}

export class AIRecommendationExecutionRequestedEvent extends DomainEvent {
  public static readonly EVENT_NAME = 'ai.recommendation.execution_requested';
  
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly recommendationId: string,
    public readonly symbolId: string,
    public readonly suggestedSide: string,
    public readonly suggestedSize: number,
    public readonly strategyId?: string
  ) {
    super();
  }
}

export class AIRecommendationCompletedEvent extends DomainEvent {
  public static readonly EVENT_NAME = 'ai.recommendation.completed';
  
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly recommendationId: string
  ) {
    super();
  }
}

export class AIRecommendationFailedEvent extends DomainEvent {
  public static readonly EVENT_NAME = 'ai.recommendation.failed';
  
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly recommendationId: string,
    public readonly error: string
  ) {
    super();
  }
}
