import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationEngineService } from './correlation-engine.service';
import { PrismaService } from '@veerox/database';

describe('CorrelationEngineService', () => {
  let service: CorrelationEngineService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaServiceMock = {
      symbol: {
        findMany: jest.fn(),
      },
      candle: {
        findMany: jest.fn(),
      },
      pairwiseCorrelation: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationEngineService,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    service = module.get<CorrelationEngineService>(CorrelationEngineService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not do anything if there are less than 2 active symbols', async () => {
    (prismaService.symbol.findMany as jest.Mock).mockResolvedValue([
      { id: '1', standardSymbol: 'BTCUSD' },
    ]);

    await service.generateCorrelationMatrix('H1');

    expect(prismaService.candle.findMany).not.toHaveBeenCalled();
    expect(prismaService.pairwiseCorrelation.upsert).not.toHaveBeenCalled();
  });

  it('should calculate pearson correlation correctly', async () => {
    (prismaService.symbol.findMany as jest.Mock).mockResolvedValue([
      { id: '1', standardSymbol: 'BTCUSD' },
      { id: '2', standardSymbol: 'ETHUSD' },
    ]);

    // perfectly positively correlated values
    (prismaService.candle.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { close: 1 }, { close: 2 }, { close: 3 }, { close: 4 }, { close: 5 },
      ])
      .mockResolvedValueOnce([
        { close: 2 }, { close: 4 }, { close: 6 }, { close: 8 }, { close: 10 },
      ]);

    await service.generateCorrelationMatrix('H1', 5);

    expect(prismaService.pairwiseCorrelation.upsert).toHaveBeenCalledTimes(2); // A->B and B->A
    
    expect(prismaService.pairwiseCorrelation.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({
        symbolIdA: '1',
        symbolIdB: '2',
        correlationScore: 1, // perfect positive correlation
      })
    }));
  });

  it('should throw an error if missing authoritative upstream dependency', async () => {
    (prismaService.symbol.findMany as jest.Mock).mockResolvedValue([
      { id: '1', standardSymbol: 'BTCUSD' },
      { id: '2', standardSymbol: 'ETHUSD' },
    ]);

    // return insufficient data for the first symbol
    (prismaService.candle.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { close: 1 }, { close: 2 },
      ]);

    await expect(service.generateCorrelationMatrix('H1', 5)).rejects.toThrow('MISSING AUTHORITATIVE UPSTREAM DEPENDENCY');
  });

  it('should calculate pearson properly logic', () => {
      // test case for standard calculation without mocking
      const x = [1, 2, 3];
      const y = [1, 2, 3];
      const result = (service as unknown as { calculatePearsonCorrelation: (x: number[], y: number[]) => number }).calculatePearsonCorrelation(x, y);
      expect(result).toBeCloseTo(1);
  });
});
