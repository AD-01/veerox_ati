import { AggregateRoot } from '@nestjs/cqrs';
import { Decimal } from '@prisma/client/runtime/library';

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

  public get properties(): Readonly<AIConfigurationProps> {
    return Object.freeze({ ...this.props });
  }

  public static create(props: AIConfigurationProps): AIConfiguration {
    return new AIConfiguration(props);
  }

  public static reconstitute(props: AIConfigurationProps): AIConfiguration {
    return new AIConfiguration(props);
  }
}
