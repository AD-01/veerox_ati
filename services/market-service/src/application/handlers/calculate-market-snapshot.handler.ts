import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CalculateMarketSnapshotCommand } from '../commands/calculate-market-snapshot.command';
import { IntelligenceEngineService } from '../../domain/services/intelligence-engine.service';
import { MarketSnapshotRepository } from '../../infrastructure/repositories/market-snapshot.repository';
import { MarketIntelligenceUpdatedEvent, MarketSnapshotGeneratedEvent } from '@veerox/events';
import { ISymbolRepository, SYMBOL_REPOSITORY } from '../ports/symbol.repository.interface';
import { Inject } from '@nestjs/common';

@CommandHandler(CalculateMarketSnapshotCommand)
export class CalculateMarketSnapshotHandler implements ICommandHandler<CalculateMarketSnapshotCommand> {
  private readonly logger = new Logger(CalculateMarketSnapshotHandler.name);

  constructor(
    private readonly intelligenceEngine: IntelligenceEngineService,
    private readonly repository: MarketSnapshotRepository,
    @Inject(SYMBOL_REPOSITORY)
    private readonly symbolRepository: ISymbolRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CalculateMarketSnapshotCommand): Promise<void> {
    this.logger.debug(`Calculating market snapshot for ${command.symbolId} at ${command.timeframe} (${command.timestamp.toISOString()})`);

    // 1. Generate the domain snapshot
    const snapshot = this.intelligenceEngine.generateSnapshot({
      symbolId: command.symbolId,
      timeframe: command.timeframe,
      timestamp: command.timestamp,
      open: command.open,
      high: command.high,
      low: command.low,
      close: command.close,
      volume: command.volume,
    });

    // 2. Persist the snapshot
    await this.repository.upsert(snapshot);

    // 3. Publish the Domain Event
    const event = new MarketIntelligenceUpdatedEvent(
      snapshot.symbolId,
      snapshot.timestamp,
      snapshot.timeframe,
      { direction: snapshot.trendDirection, strength: snapshot.trendStrength },
      snapshot.volatility,
      snapshot.liquidityScore,
      snapshot.regime,
      snapshot.confidenceScore,
      snapshot.marketHealthScore,
      snapshot.snapshotVersion
    );

    this.eventBus.publish(event);
    this.logger.debug(`Published MarketIntelligenceUpdatedEvent for ${snapshot.symbolId}`);

    // Fetch symbol to get contractSize
    const symbol = await this.symbolRepository.findById(snapshot.symbolId);
    if (!symbol) {
      this.logger.warn(`Symbol ${snapshot.symbolId} not found, skipping MarketSnapshotGeneratedEvent`);
      return;
    }

    const generatedEvent = new MarketSnapshotGeneratedEvent(
      snapshot.symbolId,
      snapshot.referencePrice,
      symbol.contractSize,
      snapshot.volatility,
      snapshot.regime,
      snapshot.timestamp,
    );

    this.eventBus.publish(generatedEvent);
    this.logger.debug(`Published MarketSnapshotGeneratedEvent for ${snapshot.symbolId}`);
  }
}
