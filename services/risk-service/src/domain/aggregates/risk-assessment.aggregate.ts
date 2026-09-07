import { AggregateRoot } from '@nestjs/cqrs';
import { RiskCalculatedEvent } from '../events/risk-calculated.event';
import { RiskScore } from '../entities/risk-score.value-object';
import { PositionSize } from '../entities/position-size.value-object';

export class RiskAssessment extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string | null,
    private riskScore: RiskScore,
    private decisionOutcome: string, // APPROVED, REJECTED
    private permittedSize: PositionSize | null,
    private inputsJson: string,
    private policiesJson: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  public static generate(
    id: string,
    organizationId: string,
    workspaceId: string,
    correlationId: string | null,
    riskScore: RiskScore,
    decisionOutcome: string,
    permittedSize: PositionSize | null,
    inputsJson: string,
    policiesJson: string,
    timestamp: Date,
  ): RiskAssessment {
    const assessment = new RiskAssessment(
      id,
      organizationId,
      workspaceId,
      correlationId,
      riskScore,
      decisionOutcome,
      permittedSize,
      inputsJson,
      policiesJson,
      timestamp,
    );

    assessment.apply(
      new RiskCalculatedEvent(
        id,
        organizationId,
        workspaceId,
        correlationId,
        riskScore.value,
        decisionOutcome,
        timestamp,
      ),
    );

    return assessment;
  }

  public getRiskScore(): RiskScore {
    return this.riskScore;
  }

  public getDecisionOutcome(): string {
    return this.decisionOutcome;
  }

  public getPermittedSize(): PositionSize | null {
    return this.permittedSize;
  }

  public getInputsJson(): string {
    return this.inputsJson;
  }

  public getPoliciesJson(): string {
    return this.policiesJson;
  }
}
