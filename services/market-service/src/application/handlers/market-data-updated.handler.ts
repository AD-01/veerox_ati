import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { MarketDataUpdatedEvent } from '@veerox/events';
import { CalculateMarketSnapshotCommand } from '../commands/calculate-market-snapshot.command';

@EventsHandler(MarketDataUpdatedEvent)
export class MarketDataUpdatedHandler implements IEventHandler<MarketDataUpdatedEvent> {
  private readonly logger = new Logger(MarketDataUpdatedHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: MarketDataUpdatedEvent): Promise<void> {
    // Optimization: Only generate market intelligence snapshots on closed candles.
    // This avoids excessive DB writes and noisy snapshot events for every intra-candle tick.
    if (!event.isClosed) {
      return;
    }

    this.logger.debug(`Received closed MarketDataUpdatedEvent for ${event.symbolId} at ${event.timeframe}. Dispatching snapshot calculation.`);

    const command = new CalculateMarketSnapshotCommand(
      event.symbolId,
      event.timeframe,
      event.timestamp,
      event.open,
      event.high,
      event.low,
      event.close,
      event.volume,
    );

    await this.commandBus.execute(command);
  }
}
