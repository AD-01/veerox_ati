import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { EvaluateRiskCommand } from '../../commands/risk-assessment/evaluate-risk.command';
import { PrismaService, OpenPositionReadModel } from '@veerox/database';

import { MarketSnapshotGeneratedEvent } from '@veerox/events';
import { PortfolioSynchronizedEvent } from '@veerox/events';

@EventsHandler(MarketSnapshotGeneratedEvent, PortfolioSynchronizedEvent)
export class RecalculateRiskEventHandler implements IEventHandler<MarketSnapshotGeneratedEvent | PortfolioSynchronizedEvent> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  async handle(event: MarketSnapshotGeneratedEvent | PortfolioSynchronizedEvent) {
    let positionsToRecalculate: OpenPositionReadModel[] = [];

    if (event instanceof PortfolioSynchronizedEvent) {
      // Find active strategies or open positions for this workspace/account
      const openPositions = await this.prisma.openPositionReadModel.findMany({
        where: { workspaceId: event.workspaceId, status: 'OPEN' }
      });
      // In a real implementation we would map these to strategies
      positionsToRecalculate = openPositions;
    } else if (event instanceof MarketSnapshotGeneratedEvent) {
      // Find open positions affected by this symbol's price change
      const openPositions = await this.prisma.openPositionReadModel.findMany({
        where: { symbolId: event.symbolId, status: 'OPEN' }
      });
      positionsToRecalculate = openPositions;
    }

    // Dispatch commands
    for (const position of positionsToRecalculate) {
      if (!position.strategyId) continue;

      // Find accountId if not present
      let accountId = 'accountId' in event ? event.accountId : undefined;
      if (!accountId) {
        const account = await this.prisma.tradingAccount.findFirst({
          where: { workspaceId: position.workspaceId },
        });
        if (!account) continue;
        accountId = account.id;
      }

      // Use actual size and direction from the database
      const command = new EvaluateRiskCommand(
        position.workspaceId,
        position.strategyId,
        accountId,
        position.symbolId,
        position.direction as 'LONG' | 'SHORT',
        Number(position.size),
        'system',
      );

      // Async dispatch
      this.commandBus.execute(command).catch(err => {
        console.error('Async risk recalculation failed', err);
      });
    }
  }
}
