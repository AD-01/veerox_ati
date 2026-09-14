import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { TradingOpportunityGeneratedEvent } from '@veerox/events';
import { v4 as uuidv4 } from 'uuid';

@EventsHandler(TradingOpportunityGeneratedEvent)
export class TradingOpportunityEventHandler implements IEventHandler<TradingOpportunityGeneratedEvent> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: TradingOpportunityGeneratedEvent) {
    // We need correlationId. For Strategy signals, one might not be present unless it's chained.
    // If none, generate one for the orchestrator context.
    const correlationId = event.correlationId || uuidv4();

    // Truncate to the nearest minute
    const timeWindow = new Date(event.timestamp);
    timeWindow.setSeconds(0, 0);

    try {
      // Save intent to DB
      await this.prisma.signalIntent.create({
        data: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          correlationId: correlationId,
          symbolId: event.symbolId,
          source: 'STRATEGY',
          sourceId: event.strategyId,
          direction: event.direction,
          size: event.size,
          status: 'PENDING',
          timeWindow,
        },
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        // Idempotency: duplicate strategy signal intent gracefully ignored
        return;
      }
      throw error;
    }
  }
}
