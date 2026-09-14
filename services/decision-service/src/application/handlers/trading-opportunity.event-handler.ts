import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TradingOpportunityGeneratedEvent } from '@veerox/events';
import { CorrelationService } from '../services/correlation.service';

@EventsHandler(TradingOpportunityGeneratedEvent)
export class TradingOpportunityEventHandler implements IEventHandler<TradingOpportunityGeneratedEvent> {
  private readonly logger = new Logger(TradingOpportunityEventHandler.name);

  constructor(private readonly correlationService: CorrelationService) {}

  async handle(event: TradingOpportunityGeneratedEvent) {
    this.logger.log(`Received Trading Opportunity ${event.correlationId} for Strategy ${event.strategyId}. Submitting for correlation.`);

    // S-20: TradingOpportunityGeneratedEvent is now intercepted by Orchestrator.
    // Decision service no longer correlates this event directly to prevent bypassing the Orchestrator.
    // It remains here for analytics tracking if needed, but execution happens via SignalOrchestratedEvent.
  }
}
