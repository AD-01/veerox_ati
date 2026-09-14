import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AIRecommendationExecutionRequestedEvent } from '@veerox/events';
import { CorrelationService } from '../services/correlation.service';
import { PrismaService } from '@veerox/database';

@EventsHandler(AIRecommendationExecutionRequestedEvent)
export class AIRecommendationExecutionRequestedEventHandler implements IEventHandler<AIRecommendationExecutionRequestedEvent> {
  private readonly logger = new Logger(AIRecommendationExecutionRequestedEventHandler.name);

  constructor(
    private readonly correlationService: CorrelationService,
    private readonly prisma: PrismaService
  ) {}

  async handle(event: AIRecommendationExecutionRequestedEvent) {
    this.logger.log(`Received AI Recommendation Execution Requested ${event.correlationId} for decision correlation.`);

    const account = await this.prisma.tradingAccount.findFirst({
      where: { workspaceId: event.workspaceId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!account) {
      this.logger.error(`No active trading account found for workspace ${event.workspaceId}`);
      return;
    }

    // S-20: AIRecommendationExecutionRequestedEvent is now intercepted by Orchestrator.
    // Decision service no longer correlates this event directly to prevent bypassing the Orchestrator.
    // It remains here for analytics or SIGNAL_ONLY tracking if needed, but execution happens via SignalOrchestratedEvent.
  }
}
