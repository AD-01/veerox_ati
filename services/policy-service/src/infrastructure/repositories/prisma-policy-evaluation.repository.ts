import { PrismaClient } from '@prisma/client';
import { IPolicyEvaluationRepository, PolicyEvaluationRecord } from '../../domain/interfaces/policy-evaluation.repository.interface';

export class PrismaPolicyEvaluationRepository implements IPolicyEvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(evaluation: PolicyEvaluationRecord): Promise<void> {
    await this.prisma.policyEvaluation.create({
      data: {
        id: evaluation.id,
        decisionId: evaluation.decisionId,
        policyId: evaluation.policyId,
        correlationId: evaluation.correlationId,
        organizationId: evaluation.organizationId,
        workspaceId: evaluation.workspaceId,
        outcome: evaluation.outcome,
        policyVersion: evaluation.policyVersion,
        violations: JSON.stringify(evaluation.violations),
        effectiveLimits: JSON.stringify(evaluation.effectiveLimits),
        explanation: JSON.stringify(evaluation.explanation),
        createdAt: evaluation.createdAt,
      },
    });
  }

  async findByCorrelationId(organizationId: string, workspaceId: string, correlationId: string): Promise<PolicyEvaluationRecord[]> {
    const records = await this.prisma.policyEvaluation.findMany({
      where: { correlationId },
    });

    return records
      .filter(record => record.organizationId === organizationId && record.workspaceId === workspaceId)
      .map(record => ({
        ...record,
        outcome: record.outcome as 'ALLOW' | 'REJECT',
        violations: JSON.parse(record.violations),
        effectiveLimits: JSON.parse(record.effectiveLimits),
        explanation: JSON.parse(record.explanation),
      }));
  }

  async findByDecisionId(organizationId: string, workspaceId: string, decisionId: string): Promise<PolicyEvaluationRecord[]> {
    const records = await this.prisma.policyEvaluation.findMany({
      where: {
        decisionId,
        organizationId,
        workspaceId,
      },
    });

    return records.map(record => ({
      ...record,
      outcome: record.outcome as 'ALLOW' | 'REJECT',
      violations: JSON.parse(record.violations),
      effectiveLimits: JSON.parse(record.effectiveLimits),
      explanation: JSON.parse(record.explanation),
    }));
  }
}
