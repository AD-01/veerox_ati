import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { StrategyMetricsUpdatedEvent } from '@veerox/events';

@Injectable()
export class StrategyMetricsService {
  private readonly logger = new Logger(StrategyMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async updateMetrics(strategyId: string, organizationId: string, confidenceScore: number, historicalPerformance: string): Promise<void> {
    this.logger.log(`Updating metrics for strategy ${strategyId}`);

    // Update authoritative database model
    await this.prisma.strategyMetrics.upsert({
      where: { strategyId },
      update: {
        confidenceScore,
        historicalPerformance,
      },
      create: {
        strategyId,
        organizationId,
        confidenceScore,
        historicalPerformance,
      },
    });

    // Publish event for read-models (like DecisionService)
    const event = new StrategyMetricsUpdatedEvent(
      strategyId,
      organizationId,
      confidenceScore,
      historicalPerformance,
      new Date()
    );

    this.eventBus.publish(event);
  }
}
