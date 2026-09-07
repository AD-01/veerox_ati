import { CandleGeneratorService } from './candle-generator.service';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { NormalizedTick } from './tick-normalizer.service';

describe('CandleGeneratorService', () => {
  let service: CandleGeneratorService;
  let mockPrismaService: unknown;
  let mockEventBus: unknown;

  beforeEach(() => {
    mockPrismaService = {
      candle: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    
    mockEventBus = {
      publish: jest.fn(),
    };

    service = new CandleGeneratorService(
      mockPrismaService as unknown as PrismaService,
      mockEventBus as unknown as EventBus,
    );
  });

  it('should create and update a candle for a single tick', async () => {
    const tick: NormalizedTick = {
      symbolId: 'symbol-1',
      timestamp: new Date('2026-08-12T10:00:05Z'),
      bid: 1.1000,
      ask: 1.1001,
      volume: 1,
    };

    await service.processTick(tick);

    // M1 timeframe start should be 10:00:00Z
    const activeCandles = (service as unknown as { activeCandles: Map<string, Map<string, import('./candle-generator.service').CandleState>> }).activeCandles.get('symbol-1')!;
    expect(activeCandles).toBeDefined();
    
    const m1Candle = activeCandles.get('M1')!;
    expect(m1Candle).toBeDefined();
    expect(m1Candle.open).toBe(1.1000);
    expect(m1Candle.high).toBe(1.1000);
    expect(m1Candle.low).toBe(1.1000);
    expect(m1Candle.close).toBe(1.1000);
    expect(m1Candle.tickCount).toBe(1);
    expect(m1Candle.isClosed).toBe(false);
  });

  it('should close an old candle when a tick for a new timeframe arrives and emit event', async () => {
    const tick1: NormalizedTick = {
      symbolId: 'symbol-1',
      timestamp: new Date('2026-08-12T10:00:55Z'),
      bid: 1.1000,
      ask: 1.1001,
      volume: 1,
    };

    const tick2: NormalizedTick = {
      symbolId: 'symbol-1',
      timestamp: new Date('2026-08-12T10:01:05Z'), // New minute
      bid: 1.1050,
      ask: 1.1051,
      volume: 2,
    };

    await service.processTick(tick1);
    await service.processTick(tick2);

    expect((mockPrismaService as unknown as { candle: { upsert: jest.Mock } }).candle.upsert).toHaveBeenCalled();
    expect((mockEventBus as unknown as { publish: jest.Mock }).publish).toHaveBeenCalled();
    
    const activeCandles = (service as unknown as { activeCandles: Map<string, Map<string, import('./candle-generator.service').CandleState>> }).activeCandles.get('symbol-1')!;
    const m1Candle = activeCandles.get('M1')!;
    
    // The new M1 candle should represent tick2
    expect(m1Candle.open).toBe(1.1050);
    expect(m1Candle.tickCount).toBe(1);
  });

  it('should strictly discard a late tick for a closed candle timeframe', async () => {
    const tick1: NormalizedTick = {
      symbolId: 'symbol-1',
      timestamp: new Date('2026-08-12T10:01:05Z'), // 10:01 candle
      bid: 1.1000,
      ask: 1.1001,
      volume: 1,
    };

    const tick2Late: NormalizedTick = {
      symbolId: 'symbol-1',
      timestamp: new Date('2026-08-12T10:00:55Z'), // late tick for 10:00 candle
      bid: 1.1050,
      ask: 1.1051,
      volume: 2,
    };

    // First process the newer tick to establish the 10:01 candle
    await service.processTick(tick1);
    
    const activeCandles = (service as unknown as { activeCandles: Map<string, Map<string, import('./candle-generator.service').CandleState>> }).activeCandles.get('symbol-1')!;
    let m1Candle = activeCandles.get('M1')!;
    
    expect(m1Candle.tickCount).toBe(1);

    // Process the late tick
    await service.processTick(tick2Late);

    m1Candle = activeCandles.get('M1')!;
    
    // Ensure the M1 candle was NOT updated by the late tick
    expect(m1Candle.tickCount).toBe(1);
    expect(m1Candle.high).toBe(1.1000);
  });
});
