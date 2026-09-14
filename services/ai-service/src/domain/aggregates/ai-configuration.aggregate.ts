import { AggregateRoot } from '@nestjs/cqrs';
import Decimal from 'decimal.js';

export interface AIConfigurationProps {
  id: string;
  organizationId: string;
  workspaceId: string;
  enabled: boolean;
  executionMode: string;
  minimumConfidence: Decimal;
  maxRiskPerTrade: Decimal;
  maxDailyLoss: Decimal;
  maxOpenPositions: number;
  maxPositionSize: Decimal;
  requirePolicyApproval: boolean;
  allowedSymbols: string | null;
  allowedSessions: string | null;
  inferenceIntervalMinutes: number;
  lastInferenceAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AIConfiguration extends AggregateRoot {
  private constructor(private readonly props: AIConfigurationProps) {
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

  public get enabled(): boolean {
    return this.props.enabled;
  }

  public get executionMode(): string {
    return this.props.executionMode;
  }

  public get inferenceIntervalMinutes(): number {
    return this.props.inferenceIntervalMinutes;
  }

  public get lastInferenceAt(): Date | null {
    return this.props.lastInferenceAt;
  }

  public get properties(): Readonly<AIConfigurationProps> {
    return Object.freeze({ ...this.props });
  }

  public static create(props: AIConfigurationProps): AIConfiguration {
    if (!Number.isFinite(props.inferenceIntervalMinutes) || props.inferenceIntervalMinutes <= 0) {
      throw new Error('inferenceIntervalMinutes must be a finite number greater than 0');
    }
    return new AIConfiguration(props);
  }

  public static reconstitute(props: AIConfigurationProps): AIConfiguration {
    if (!Number.isFinite(props.inferenceIntervalMinutes) || props.inferenceIntervalMinutes <= 0) {
      throw new Error('inferenceIntervalMinutes must be a finite number greater than 0');
    }
    return new AIConfiguration(props);
  }

  public updateLastInference(timestamp: Date): void {
    this.props.lastInferenceAt = timestamp;
    this.props.updatedAt = new Date();
  }
}
