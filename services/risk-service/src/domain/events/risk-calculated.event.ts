export class RiskCalculatedEvent {
  constructor(
    public readonly riskAssessmentId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string | null,
    public readonly riskScore: number,
    public readonly decisionOutcome: string,
    public readonly timestamp: Date,
  ) {}
}
