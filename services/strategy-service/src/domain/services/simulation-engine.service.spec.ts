import { Test, TestingModule } from '@nestjs/testing';
import { SimulationEngineService } from './simulation-engine.service';
import { PrismaService } from '@veerox/database';
import { StrategyFactory } from '../strategies/strategy.factory';
import { IExecutableStrategy, StrategySignal, StrategyContext } from '../strategies/executable-strategy.interface';
import { Candle } from '@veerox/database';

class MockStrategy implements IExecutableStrategy {
  public signals: StrategySignal[] = [];
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialize(_config: Record<string, unknown>): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCandle(_candle: Candle, _context: StrategyContext): StrategySignal | null {
    return this.signals.shift() || null;
  }
}

describe('SimulationEngineService', () => {
  let service: SimulationEngineService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaService: any;
  let strategyFactory: Record<string, jest.Mock>;
  let mockStrategy: MockStrategy;

  beforeEach(async () => {
    mockStrategy = new MockStrategy();
    
    prismaService = {
      candle: {
        findMany: jest.fn(),
      } as unknown,
    };

    strategyFactory = {
      create: jest.fn().mockReturnValue(mockStrategy),
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationEngineService,
        { provide: PrismaService, useValue: prismaService },
        { provide: StrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get<SimulationEngineService>(SimulationEngineService);
  });

  const createCandle = (high: number, low: number, close: number, timestamp: string) => ({
    high: { toNumber: () => high },
    low: { toNumber: () => low },
    close: { toNumber: () => close },
    timestamp: new Date(timestamp),
  } as unknown);

  it('should process a basic buy and sell flow with correct PnL', async () => {
    // Candle 1: strategy emits BUY signal
    mockStrategy.signals.push({
      action: 'OPEN',
      symbol: 'EURUSD',
      direction: 'BUY',
      lotSize: 1.0,
    });
    // Candle 2: holds
    mockStrategy.signals.push(null as unknown as StrategySignal);
    // Candle 3: closes
    mockStrategy.signals.push({
      action: 'CLOSE',
      symbol: 'EURUSD',
      direction: 'BUY', // Direction doesn't matter for CLOSE action
      lotSize: 1.0,
    });

    const candles = [
      createCandle(1.1020, 1.1000, 1.1010, '2023-01-01T00:00:00Z'),
      createCandle(1.1040, 1.1020, 1.1030, '2023-01-01T00:01:00Z'),
      createCandle(1.1050, 1.1030, 1.1040, '2023-01-01T00:02:00Z'),
    ];

    (prismaService.candle.findMany as jest.Mock).mockResolvedValue(candles);

    const result = await service.runSimulation(
      'MOCK',
      ['EURUSD'],
      new Date('2023-01-01T00:00:00Z'),
      new Date('2023-01-01T00:02:00Z'),
      10000,
      {
        spread: 0.0001,
        slippage: 0.0001,
        commission: 2.0,
        instrument: { contractSize: 100000, marginPerLot: 1000 }
      }
    );

    // Entry at close 1.1010 + spread + slippage = 1.1012
    // Exit at close 1.1040 - slippage = 1.1039
    // Pnl = (1.1039 - 1.1012) * 100000 = 270 - 2.0 commission = 268
    
    expect(result.tradeHistory.length).toBe(1);
    expect(result.tradeHistory[0].pnl).toBeCloseTo(268);
    expect(result.netProfit).toBeCloseTo(268);
    expect(result.winningTrades).toBe(1);
  });

  it('should hit Stop Loss accurately', async () => {
    // Emits BUY with SL
    mockStrategy.signals.push({
      action: 'OPEN',
      symbol: 'EURUSD',
      direction: 'BUY',
      lotSize: 1.0,
      stopLoss: 1.0990,
    });
    // No more signals

    const candles = [
      createCandle(1.1010, 1.1005, 1.1010, '2023-01-01T00:00:00Z'),
      createCandle(1.1015, 1.0980, 1.0985, '2023-01-01T00:01:00Z'), // Low drops below SL
    ];
    (prismaService.candle.findMany as jest.Mock).mockResolvedValue(candles);

    const result = await service.runSimulation(
      'MOCK',
      ['EURUSD'],
      new Date(),
      new Date(),
      10000,
      {
        spread: 0,
        slippage: 0,
        commission: 0,
        instrument: { contractSize: 100000, marginPerLot: 1000 }
      }
    );

    // Entry = 1.1010
    // SL = 1.0990
    // Exit = 1.0990 - 0 = 1.0990
    // Pnl = (1.0990 - 1.1010) * 100000 = -200
    
    expect(result.tradeHistory.length).toBe(1);
    expect(result.tradeHistory[0].pnl).toBeCloseTo(-200);
    expect(result.tradeHistory[0].exitPrice).toBe(1.0990);
  });

  it('should prevent opening trade if insufficient margin', async () => {
    mockStrategy.signals.push({
      action: 'OPEN',
      symbol: 'EURUSD',
      direction: 'BUY',
      lotSize: 100.0, // 100 lots = 100 * 1000 = 100000 margin required
    });

    const candles = [
      createCandle(1.1010, 1.1005, 1.1010, '2023-01-01T00:00:00Z'),
    ];
    (prismaService.candle.findMany as jest.Mock).mockResolvedValue(candles);

    const result = await service.runSimulation(
      'MOCK',
      ['EURUSD'],
      new Date(),
      new Date(),
      10000, // Balance 10K < 100K Required
      {
        instrument: { contractSize: 100000, marginPerLot: 1000 }
      }
    );

    expect(result.tradeHistory.length).toBe(0); // Rejected
  });
});
