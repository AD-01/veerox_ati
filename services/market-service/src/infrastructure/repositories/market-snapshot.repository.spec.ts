import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, Prisma } from '@veerox/database';
import { MarketSnapshotRepository } from './market-snapshot.repository';
import { MarketSnapshot } from '../../domain/aggregates/market-snapshot.aggregate';

describe('MarketSnapshotRepository', () => {
  let repository: MarketSnapshotRepository;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaServiceMock = {
      marketSnapshot: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketSnapshotRepository,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    repository = module.get<MarketSnapshotRepository>(MarketSnapshotRepository);
    prismaService = module.get(PrismaService);
  });

  it('should upsert a snapshot successfully', async () => {
    const snapshot = MarketSnapshot.create({
      symbolId: '00000000-0000-0000-0000-000000000000',
      timeframe: 'M1',
      timestamp: new Date('2026-08-12T10:00:00.000Z'),
      referencePrice: 1.5,
      trendDirection: 'UP',
      trendStrength: 75,
      volatility: 0.005,
      liquidityScore: 90,
      regime: 'Trending',
      confidenceScore: 85,
      marketHealthScore: 95,
    });

    (prismaService.marketSnapshot.upsert as jest.Mock).mockResolvedValue(undefined);

    await expect(repository.upsert(snapshot)).resolves.not.toThrow();

    expect(prismaService.marketSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          symbolId_timeframe_timestamp: {
            symbolId: snapshot.symbolId,
            timeframe: snapshot.timeframe,
            timestamp: snapshot.timestamp,
          },
        },
        update: expect.objectContaining({
          referencePrice: 1.5,
          trendDirection: 'UP',
        }),
        create: expect.objectContaining({
          id: snapshot.id,
        }),
      })
    );
  });

  it('should find snapshots by symbol and timeframe', async () => {
    const timestamp = new Date();
    (prismaService.marketSnapshot.findMany as jest.Mock).mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        symbolId: '00000000-0000-0000-0000-000000000000',
        timeframe: 'M1',
        timestamp,
        referencePrice: { toNumber: () => 1.5 } as unknown as Prisma.Decimal,
        trendDirection: 'UP',
        trendStrength: 75,
        volatility: { toNumber: () => 0.005 } as unknown as Prisma.Decimal,
        liquidityScore: 90,
        regime: 'Trending',
        confidenceScore: 85,
        marketHealthScore: 95,
        snapshotVersion: 1,
        createdAt: timestamp,
      },
    ]);

    const results = await repository.findBySymbolAndTimeframe('00000000-0000-0000-0000-000000000000', 'M1', 10);

    expect(results).toHaveLength(1);
    expect(results[0].trendDirection).toBe('UP');
    expect(results[0].volatility).toBe(0.005);
  });
});
