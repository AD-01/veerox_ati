import { Injectable } from '@nestjs/common';
import { StrategyOrchestration } from '../../domain/aggregates/strategy-orchestration.aggregate';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

@Injectable()
export class StrategyOrchestrationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async save(aggregate: StrategyOrchestration): Promise<void> {
    const data = {
      currentStrategyId: aggregate.currentStrategyId,
      currentExpertAdvisorId: aggregate.currentExpertAdvisorId,
    };

    await this.prisma.strategyOrchestration.upsert({
      where: { workspaceId: aggregate.workspaceId },
      create: {
        workspaceId: aggregate.workspaceId,
        ...data,
      },
      update: data,
    });

    aggregate.commit();
  }

  async findByWorkspaceId(workspaceId: string): Promise<StrategyOrchestration | null> {
    const record = await this.prisma.strategyOrchestration.findUnique({
      where: { workspaceId },
    });

    if (!record) return null;

    const aggregate = new StrategyOrchestration(
      record.workspaceId,
      record.currentStrategyId,
      record.currentExpertAdvisorId,
    );

    return this.publisher.mergeObjectContext(aggregate);
  }

  async findActiveOrchestrations(): Promise<StrategyOrchestration[]> {
    const records = await this.prisma.strategyOrchestration.findMany({
      where: {
        currentStrategyId: { not: null },
      },
    });

    return records.map(record => {
      const aggregate = new StrategyOrchestration(
        record.workspaceId,
        record.currentStrategyId,
        record.currentExpertAdvisorId,
      );
      return this.publisher.mergeObjectContext(aggregate);
    });
  }
}
