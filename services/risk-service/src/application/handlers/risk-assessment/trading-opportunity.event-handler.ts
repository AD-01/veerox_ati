import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TradingOpportunityGeneratedEvent } from '@veerox/events';
import { EvaluateRiskCommand } from '../../commands/risk-assessment/evaluate-risk.command';

@EventsHandler(TradingOpportunityGeneratedEvent)
export class TradingOpportunityEventHandler implements IEventHandler<TradingOpportunityGeneratedEvent> {
  private readonly logger = new Logger(TradingOpportunityEventHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: TradingOpportunityGeneratedEvent) {
    this.logger.log(`Received Trading Opportunity ${event.correlationId} for risk evaluation.`);

    const command = new EvaluateRiskCommand(
      event.workspaceId,
      event.accountId,
      event.symbolId,
      event.strategyId,
      event.direction as 'LONG' | 'SHORT',
      event.size,
      'system-ati',
      event.correlationId,
      event.stopLoss || undefined,
      event.takeProfit || undefined
    );

    try {
      await this.commandBus.execute(command);
      this.logger.log(`Successfully evaluated risk for opportunity ${event.correlationId}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to evaluate risk for opportunity ${event.correlationId}: ${err.message}`, err.stack);
    }
  }
}
