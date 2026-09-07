import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { CalculateMarketSnapshotHandler } from './calculate-market-snapshot.handler';
import { IntelligenceEngineService } from '../../domain/services/intelligence-engine.service';
import { MarketSnapshotRepository } from '../../infrastructure/repositories/market-snapshot.repository';
import { CalculateMarketSnapshotCommand } from '../commands/calculate-market-snapshot.command';
import { MarketSnapshot } from '../../domain/aggregates/market-snapshot.aggregate';
import { MarketIntelligenceUpdatedEvent, MarketSnapshotGeneratedEvent } from '@veerox/events';
import { SYMBOL_REPOSITORY, ISymbolRepository } from '../../application/ports/symbol.repository.interface';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';

describe('CalculateMarketSnapshotHandler', () => {
  let handler: CalculateMarketSnapshotHandler;
  let intelligenceEngine: jest.Mocked<IntelligenceEngineService>;
  let repository: jest.Mocked<MarketSnapshotRepository>;
  let symbolRepository: jest.Mocked<ISymbolRepository>;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(async () => {
    const intelligenceEngineMock = {
      generateSnapshot: jest.fn(),
    };
    const repositoryMock = {
      upsert: jest.fn(),
    };
    const symbolRepositoryMock = {
      findById: jest.fn(),
    };
    const eventBusMock = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculateMarketSnapshotHandler,
        { provide: IntelligenceEngineService, useValue: intelligenceEngineMock },
        { provide: MarketSnapshotRepository, useValue: repositoryMock },
        { provide: SYMBOL_REPOSITORY, useValue: symbolRepositoryMock },
        { provide: EventBus, useValue: eventBusMock },
      ],
    }).compile();

    handler = module.get<CalculateMarketSnapshotHandler>(CalculateMarketSnapshotHandler);
    intelligenceEngine = module.get(IntelligenceEngineService);
    repository = module.get(MarketSnapshotRepository);
    symbolRepository = module.get(SYMBOL_REPOSITORY);
    eventBus = module.get(EventBus);
  });

  it('should generate, persist, and publish a market snapshot', async () => {
    const command = new CalculateMarketSnapshotCommand(
      '00000000-0000-0000-0000-000000000000',
      'M5',
      new Date('2026-08-12T10:05:00.000Z'),
      1.1000,
      1.1050,
      1.0990,
      1.1040,
      1500
    );

    const snapshot = MarketSnapshot.create({
      symbolId: command.symbolId,
      timeframe: command.timeframe,
      timestamp: command.timestamp,
      referencePrice: 1.1040,
      trendDirection: 'UP',
      trendStrength: 80,
      volatility: 0.005,
      liquidityScore: 90,
      regime: 'Trending',
      confidenceScore: 85,
      marketHealthScore: 87,
    });

    intelligenceEngine.generateSnapshot.mockReturnValue(snapshot);
    repository.upsert.mockResolvedValue(undefined);
    symbolRepository.findById.mockResolvedValue({ contractSize: 100000 } as unknown as SymbolAggregate);

    await handler.execute(command);

    expect(intelligenceEngine.generateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        symbolId: command.symbolId,
        open: 1.1000,
        close: 1.1040,
      })
    );

    expect(repository.upsert).toHaveBeenCalledWith(snapshot);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(MarketIntelligenceUpdatedEvent)
    );
    
    const publishedEvent = eventBus.publish.mock.calls[0][0] as MarketIntelligenceUpdatedEvent;
    expect(publishedEvent.symbolId).toBe(snapshot.symbolId);
    expect(publishedEvent.trend.direction).toBe('UP');
    expect(publishedEvent.marketHealthScore).toBe(87);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(MarketSnapshotGeneratedEvent)
    );

    const generatedEvent = eventBus.publish.mock.calls[1][0] as MarketSnapshotGeneratedEvent;
    expect(generatedEvent.symbolId).toBe(snapshot.symbolId);
    expect(generatedEvent.referencePrice).toBe(1.1040);
    expect(generatedEvent.contractSize).toBe(100000);
  });
});
