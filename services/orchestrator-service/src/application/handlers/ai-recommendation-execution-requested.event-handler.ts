import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { AIRecommendationExecutionRequestedEvent } from '@veerox/events';

@EventsHandler(AIRecommendationExecutionRequestedEvent)
export class AIRecommendationExecutionRequestedEventHandler implements IEventHandler<AIRecommendationExecutionRequestedEvent> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: AIRecommendationExecutionRequestedEvent) {
    // Truncate to the nearest minute or 5 minutes as the time window for signal multiplexing
    const timeWindow = new Date(event.occurredOn);
    timeWindow.setSeconds(0, 0);

    try {
      // Save intent to DB
      await this.prisma.signalIntent.create({
        data: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          correlationId: event.correlationId,
          symbolId: event.symbolId,
          source: 'AI',
          sourceId: event.recommendationId,
          direction: event.suggestedSide as 'BUY' | 'SELL',
          size: event.suggestedSize,
          status: 'PENDING',
          timeWindow,
        },
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        // Idempotency: duplicate AI signal intent gracefully ignored
        return;
      }
      throw error;
    }
  }
}
