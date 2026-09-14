import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortfolioReconciliationRequestedEvent } from '@veerox/events';
import { ReconcilePortfolioCommand } from '../commands/reconcile-portfolio.command';

@EventsHandler(PortfolioReconciliationRequestedEvent)
export class PortfolioReconciliationRequestedEventHandler implements IEventHandler<PortfolioReconciliationRequestedEvent> {
  private readonly logger = new Logger(PortfolioReconciliationRequestedEventHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: PortfolioReconciliationRequestedEvent) {
    this.logger.log(`Handling PortfolioReconciliationRequestedEvent for account ${event.tradingAccountId}`);

    const command = new ReconcilePortfolioCommand(
      event.organizationId,
      event.workspaceId,
      event.tradingAccountId,
      event.externalSnapshotId,
      new Date(event.snapshotTimestamp),
      event.positions,
      Number(event.balance),
      Number(event.equity),
      0, // realizedPnl
      0  // freeMargin
    );

    await this.commandBus.execute(command);
  }
}
