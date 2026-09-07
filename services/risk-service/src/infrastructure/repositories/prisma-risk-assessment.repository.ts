import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { IRiskAssessmentRepository } from '../../application/handlers/risk-assessment/evaluate-risk.command-handler';
import { RiskAssessment } from '../../domain/aggregates/risk-assessment.aggregate';
import { RiskScore } from '../../domain/entities/risk-score.value-object';


@Injectable()
export class PrismaRiskAssessmentRepository implements IRiskAssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(assessment: RiskAssessment): Promise<void> {
    await this.prisma.riskAssessment.create({
      data: {
        id: assessment.id,
        organizationId: assessment.organizationId,
        workspaceId: assessment.workspaceId,
        correlationId: assessment.correlationId,
        riskScore: assessment.getRiskScore().value,
        decisionOutcome: assessment.getDecisionOutcome(),
        inputsJson: assessment.getInputsJson(),
        policiesJson: assessment.getPoliciesJson(),
        timestamp: assessment.timestamp,
      },
    });
  }

  async findByCorrelationId(correlationId: string): Promise<RiskAssessment | null> {
    const raw = await this.prisma.riskAssessment.findFirst({
      where: { correlationId },
    });

    if (!raw) return null;

    // Reconstruction logic...
    const riskScore = RiskScore.create(raw.riskScore);
    // omitted position size recovery for brevity
    
    return RiskAssessment.generate(
      raw.id,
      raw.organizationId,
      raw.workspaceId,
      raw.correlationId,
      riskScore,
      raw.decisionOutcome,
      null, // permitted size
      raw.inputsJson,
      raw.policiesJson,
      raw.timestamp,
    );
  }
}
