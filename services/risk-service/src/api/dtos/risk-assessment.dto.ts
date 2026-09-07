export class RiskAssessmentDto {
  id!: string;
  riskScore!: number;
  riskCategory!: string;
  decisionOutcome!: string;
  permittedSize!: number | null;
  correlationId!: string | null;
  timestamp!: Date;
}
