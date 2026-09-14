import { Injectable } from '@nestjs/common';
import { PrismaService, Decision } from '@veerox/database';
import { DecisionAggregate, DecisionOutcome, DecisionStatus } from '../../domain/aggregates/decision.aggregate';

export interface IDecisionRepository {
  save(decision: DecisionAggregate): Promise<void>;
  findById(id: string): Promise<DecisionAggregate | null>;
  findByCorrelationId(correlationId: string): Promise<DecisionAggregate | null>;
}

export const DECISION_REPOSITORY = 'DECISION_REPOSITORY';

@Injectable()
export class DecisionRepository implements IDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(decision: DecisionAggregate): Promise<void> {
    const data = {
      id: decision.id,
      organizationId: decision.organizationId,
      workspaceId: decision.workspaceId,
      correlationId: decision.correlationId,
      strategyId: decision.strategyId,
      accountId: decision.accountId,
      symbolId: decision.symbolId,
      outcome: decision.outcome,
      status: decision.status,
      confidenceScore: decision.confidenceScore,
      explanation: JSON.stringify(decision.explanation),
      context: JSON.stringify(decision.context),
    };

    await this.prisma.decision.upsert({
      where: { id: decision.id },
      create: data,
      update: {
        outcome: decision.outcome,
        status: decision.status,
        confidenceScore: decision.confidenceScore,
        explanation: JSON.stringify(decision.explanation),
        context: JSON.stringify(decision.context),
      },
    });
  }

  async findById(id: string): Promise<DecisionAggregate | null> {
    const record = await this.prisma.decision.findUnique({ where: { id } });
    if (!record) return null;
    return this.mapToAggregate(record);
  }

  async findByCorrelationId(correlationId: string): Promise<DecisionAggregate | null> {
    const record = await this.prisma.decision.findUnique({ where: { correlationId } });
    if (!record) return null;
    return this.mapToAggregate(record);
  }

  private mapToAggregate(record: Decision): DecisionAggregate {
    return new DecisionAggregate(
      record.id,
      record.organizationId,
      record.workspaceId,
      record.correlationId,
      record.strategyId,
      record.accountId,
      record.symbolId,
      record.outcome as DecisionOutcome,
      record.status as DecisionStatus,
      record.confidenceScore.toNumber(),
      JSON.parse(record.explanation),
      JSON.parse(record.context),
      record.createdAt,
      record.updatedAt
    );
  }
}
