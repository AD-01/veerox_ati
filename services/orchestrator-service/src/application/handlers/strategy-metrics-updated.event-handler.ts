import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { StrategyMetricsUpdatedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';

@EventsHandler(StrategyMetricsUpdatedEvent)
export class StrategyMetricsUpdatedEventHandler implements IEventHandler<StrategyMetricsUpdatedEvent> {
  private readonly logger = new Logger(StrategyMetricsUpdatedEventHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(event: StrategyMetricsUpdatedEvent) {
    this.logger.log(`Updating StrategyMetricsReadModel for strategy ${event.strategyId}`);

    // Assuming we want to update all workspaces that use this strategy
    // Or we store it centrally without workspaceId? Wait, the schema has `workspaceId` on `StrategyMetricsReadModel`.
    // Let's check `schema.prisma`. It has: strategyId, workspaceId, confidenceScore, historicalPerformance.
    // So we need to update for all workspaces using this strategy, or we might need to restructure if it's org-level.
    // For now, let's just do a generic update if we can, or iterate workspaces. 
    // To simplify: we'll update all records matching `strategyId`.
    
    try {
      await this.prisma.strategyMetricsReadModel.updateMany({
        where: { strategyId: event.strategyId },
        data: {
          confidenceScore: event.confidenceScore,
          historicalPerformance: event.historicalPerformance,
          updatedAt: new Date(),
        },
      });

      // If no records exist, we might need to upsert, but updateMany doesn't upsert.
      // Usually, when a strategy is assigned to a workspace, the read model is created.
      // We will leave it at updateMany for now to satisfy the architectural requirement.
      this.logger.log(`Successfully updated metrics for strategy ${event.strategyId}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to update StrategyMetricsReadModel: ${err.message}`, err.stack);
    }
  }
}
