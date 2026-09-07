import { TickIngestionPipeline } from './tick-ingestion.pipeline';
import { NormalizedTick } from '../../domain/services/tick-normalizer.service';
import { IMarketDataProvider } from '../../application/ports/market-provider.adapter.interface';
import { ISymbolRepository } from '../../application/ports/symbol.repository.interface';
import { TickNormalizerService } from '../../domain/services/tick-normalizer.service';
import { CandleGeneratorService } from '../../domain/services/candle-generator.service';
import { PrismaService } from '@veerox/database';

describe('TickIngestionPipeline', () => {
  let pipeline: TickIngestionPipeline;
  let mockProvider: { onTick: jest.Mock };
  let mockSymbolRepository: unknown;
  let mockNormalizer: unknown;
  let mockCandleGenerator: { processTick: jest.Mock };
  let mockPrisma: { tick: { createMany: jest.Mock } };

  beforeEach(() => {
    mockProvider = {
      onTick: jest.fn(),
    };
    mockSymbolRepository = {};
    mockNormalizer = {};
    mockCandleGenerator = {
      processTick: jest.fn(),
    };
    mockPrisma = {
      tick: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    pipeline = new TickIngestionPipeline(
      mockProvider as unknown as IMarketDataProvider,
      mockSymbolRepository as unknown as ISymbolRepository,
      mockNormalizer as unknown as TickNormalizerService,
      mockCandleGenerator as unknown as CandleGeneratorService,
      mockPrisma as unknown as PrismaService,
    );
  });

  it('should process a batch and retry on failure', async () => {
    const batch: NormalizedTick[] = [
      {
        symbolId: 'symbol-1',
        timestamp: new Date(),
        bid: 1.1,
        ask: 1.1,
        volume: 1,
      },
    ];

    // Mock DB failure on first attempt, success on second
    mockPrisma.tick.createMany
      .mockRejectedValueOnce(new Error('DB connection failed'))
      .mockResolvedValueOnce({ count: 1 });

    // Use internal private method for testing retry logic
    const processBatch = (pipeline as unknown as { processBatch: (b: NormalizedTick[]) => Promise<void> }).processBatch.bind(pipeline);
    
    // Replace timeout with an immediate resolution to speed up test
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: unknown) => {
      (cb as () => void)();
      return {} as NodeJS.Timeout;
    });

    await processBatch(batch);

    // Should have been called twice (1 fail + 1 retry)
    expect(mockPrisma.tick.createMany).toHaveBeenCalledTimes(2);
    expect(mockCandleGenerator.processTick).toHaveBeenCalledTimes(1);

    (global.setTimeout as unknown as jest.Mock).mockRestore();
  });

  it('should drop batch after max retries without throwing', async () => {
    const batch: NormalizedTick[] = [
      {
        symbolId: 'symbol-1',
        timestamp: new Date(),
        bid: 1.1,
        ask: 1.1,
        volume: 1,
      },
    ];

    // Mock DB failure consistently
    mockPrisma.tick.createMany.mockRejectedValue(new Error('DB dead'));

    const processBatch = (pipeline as unknown as { processBatch: (b: NormalizedTick[]) => Promise<void> }).processBatch.bind(pipeline);
    
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: unknown) => {
      (cb as () => void)();
      return {} as NodeJS.Timeout;
    });

    await processBatch(batch);

    // Should have been called 4 times (1 initial + 3 retries)
    expect(mockPrisma.tick.createMany).toHaveBeenCalledTimes(4);
    // Should NOT have fed candles
    expect(mockCandleGenerator.processTick).not.toHaveBeenCalled();

    (global.setTimeout as unknown as jest.Mock).mockRestore();
  });
});
