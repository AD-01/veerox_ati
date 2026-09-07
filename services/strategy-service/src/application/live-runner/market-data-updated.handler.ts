import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { MarketDataUpdatedEvent } from '@veerox/events';
import { LiveRunnerService } from '../../domain/services/live-runner.service';

@EventsHandler(MarketDataUpdatedEvent)
export class MarketDataUpdatedEventHandler implements IEventHandler<MarketDataUpdatedEvent> {
  private readonly logger = new Logger(MarketDataUpdatedEventHandler.name);

  constructor(private readonly liveRunnerService: LiveRunnerService) {}

  async handle(event: MarketDataUpdatedEvent) {
    this.logger.debug(`Received MarketDataUpdatedEvent for symbol ${event.symbolId} at ${event.timestamp}`);

    await this.liveRunnerService.processMarketDataUpdate(
      event.symbolId,
      event.timeframe,
      event.timestamp,
      event.open,
      event.high,
      event.low,
      event.close,
      event.volume,
      event.isClosed,
    );
  }
}
