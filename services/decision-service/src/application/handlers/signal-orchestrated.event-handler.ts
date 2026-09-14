import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { SignalOrchestratedEvent } from '@veerox/events';
import { CorrelationService } from '../services/correlation.service';
import { PrismaService } from '@veerox/database';

@EventsHandler(SignalOrchestratedEvent)
export class SignalOrchestratedEventHandler implements IEventHandler<SignalOrchestratedEvent> {
  private readonly logger = new Logger(SignalOrchestratedEventHandler.name);

  constructor(
    private readonly correlationService: CorrelationService,
    private readonly prisma: PrismaService
  ) {}

  async handle(event: SignalOrchestratedEvent) {
    this.logger.log(`Received Signal Orchestrated ${event.correlationId}. Submitting for correlation.`);

    const account = await this.prisma.tradingAccount.findFirst({
      where: { workspaceId: event.workspaceId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!account) {
      this.logger.error(`No active trading account found for workspace ${event.workspaceId}`);
      return;
    }

    const direction = event.direction === 'BUY' ? 'LONG' : (event.direction === 'SELL' ? 'SHORT' : event.direction);

    const opportunityPayload = {
      correlationId: event.correlationId,
      workspaceId: event.workspaceId,
      organizationId: event.organizationId,
      accountId: account.id,
      symbolId: event.symbolId,
      strategyId: event.source === 'STRATEGY' ? event.sourceId : undefined,
      direction,
      size: event.size,
      stopLoss: undefined,
      takeProfit: undefined,
    };

    await this.correlationService.correlate({
      correlationId: event.correlationId,
      workspaceId: event.workspaceId,
      organizationId: event.organizationId,
      opportunityPayload,
    });
  }
}
