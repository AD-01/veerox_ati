import { AggregateRoot } from '@nestjs/cqrs';
import { Decimal } from '@prisma/client/runtime/library';
import {
  AIRecommendationGeneratedEvent,
  AIRecommendationRejectedEvent,
  AIRecommendationExecutionRequestedEvent,
  AIRecommendationCompletedEvent,
  AIRecommendationFailedEvent,
  AIExecutionMode,
  AIRecommendationStatus,
} from '@veerox/events';
import { AppException } from '@veerox/shared';

export interface AIRecommendationProps {
  id: string;
  organizationId: string;
  workspaceId: string;
  correlationId: string;
  idempotencyKey: string;
  modelId: string;
  modelVersion: string;
  strategyId: string | null;
  symbolId: string;
  executionMode: string;
  recommendationType: string;
  confidence: Decimal;
  marketRegime: string | null;
  suggestedSide: string | null;
  suggestedSize: Decimal | null;
  suggestedEntry: Decimal | null;
  suggestedStopLoss: Decimal | null;
  suggestedTakeProfit: Decimal | null;
  reasoning: string | null;
  supportingSignals: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AIRecommendation extends AggregateRoot {
  private constructor(private readonly props: AIRecommendationProps) {
    super();
  }

  public get id(): string {
    return this.props.id;
  }
  
  public get organizationId(): string {
    return this.props.organizationId;
  }
  
  public get workspaceId(): string {
    return this.props.workspaceId;
  }
  
  public get correlationId(): string {
    return this.props.correlationId;
  }
  
  public get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  
  public get modelId(): string {
    return this.props.modelId;
  }

  public get modelVersion(): string {
    return this.props.modelVersion;
  }

  public get strategyId(): string | null {
    return this.props.strategyId;
  }

  public get symbolId(): string {
    return this.props.symbolId;
  }

  public get executionMode(): string {
    return this.props.executionMode;
  }
  
  public get status(): string {
    return this.props.status;
  }

  public get properties(): Readonly<AIRecommendationProps> {
    return Object.freeze({ ...this.props });
  }

  public static create(props: AIRecommendationProps): AIRecommendation {
    const recommendation = new AIRecommendation(props);
    
    // Publish generated event
    recommendation.apply(
      new AIRecommendationGeneratedEvent(
        props.organizationId,
        props.workspaceId,
        props.correlationId,
        props.id,
        props.modelId,
        props.modelVersion,
        props.symbolId,
        props.executionMode,
        props.recommendationType,
        props.confidence.toNumber(),
        props.strategyId || undefined,
        props.marketRegime || undefined,
        props.suggestedSide || undefined,
        props.suggestedSize ? props.suggestedSize.toNumber() : undefined,
        props.suggestedEntry ? props.suggestedEntry.toNumber() : undefined,
        props.suggestedStopLoss ? props.suggestedStopLoss.toNumber() : undefined,
        props.suggestedTakeProfit ? props.suggestedTakeProfit.toNumber() : undefined,
        props.reasoning || undefined,
        props.supportingSignals ? JSON.parse(props.supportingSignals) : undefined
      )
    );
    
    return recommendation;
  }

  public static reconstitute(props: AIRecommendationProps): AIRecommendation {
    return new AIRecommendation(props);
  }

  public requestExecution(): void {
    if (this.props.status !== AIRecommendationStatus.GENERATED) {
      throw new AppException(`Cannot request execution from status ${this.props.status}`);
    }
    if (this.props.executionMode === AIExecutionMode.SIGNAL_ONLY) {
      throw new AppException('Execution not allowed for SIGNAL_ONLY recommendations');
    }
    if (!this.props.suggestedSide || !this.props.suggestedSize) {
      throw new AppException('Execution request requires side and size');
    }

    this.props.status = AIRecommendationStatus.EXECUTION_REQUESTED;
    this.props.updatedAt = new Date();

    this.apply(
      new AIRecommendationExecutionRequestedEvent(
        this.props.organizationId,
        this.props.workspaceId,
        this.props.correlationId,
        this.props.id,
        this.props.symbolId,
        this.props.suggestedSide,
        this.props.suggestedSize.toNumber(),
        this.props.strategyId || undefined
      )
    );
  }

  public complete(): void {
    if (this.props.status !== AIRecommendationStatus.EXECUTION_REQUESTED) {
      throw new AppException(`Cannot complete recommendation from status ${this.props.status}`);
    }

    this.props.status = AIRecommendationStatus.COMPLETED;
    this.props.updatedAt = new Date();

    this.apply(
      new AIRecommendationCompletedEvent(
        this.props.organizationId,
        this.props.workspaceId,
        this.props.correlationId,
        this.props.id
      )
    );
  }

  public reject(reason: string): void {
    if (this.props.status !== AIRecommendationStatus.GENERATED) {
      throw new AppException(`Cannot reject recommendation from status ${this.props.status}`);
    }

    this.props.status = AIRecommendationStatus.REJECTED;
    this.props.updatedAt = new Date();

    this.apply(
      new AIRecommendationRejectedEvent(
        this.props.organizationId,
        this.props.workspaceId,
        this.props.correlationId,
        this.props.id,
        reason
      )
    );
  }

  public fail(error: string): void {
    // Can fail from GENERATING, GENERATED, or EXECUTION_REQUESTED
    const validFailStates = [
      AIRecommendationStatus.GENERATING,
      AIRecommendationStatus.GENERATED,
      AIRecommendationStatus.EXECUTION_REQUESTED
    ];
    if (!validFailStates.includes(this.props.status as AIRecommendationStatus)) {
      throw new AppException(`Cannot fail recommendation from terminal status ${this.props.status}`);
    }

    this.props.status = AIRecommendationStatus.FAILED;
    this.props.updatedAt = new Date();

    this.apply(
      new AIRecommendationFailedEvent(
        this.props.organizationId,
        this.props.workspaceId,
        this.props.correlationId,
        this.props.id,
        error
      )
    );
  }
}
