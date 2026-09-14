import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { GetWorkspaceMarketQuotesQueryHandler } from './get-workspace-market-quotes.query-handler';
import { GetWorkspaceMarketQuotesQuery } from '../queries/get-workspace-market-quotes.query';

describe('GetWorkspaceMarketQuotesQueryHandler (S-24 Phase 07F-A)', () => {
  let handler: GetWorkspaceMarketQuotesQueryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceMarketQuotesQueryHandler,
        {
          provide: PrismaService,
          useValue: {
            connector: { findMany: jest.fn() },
            marketProvider: { findMany: jest.fn() },
            symbol: { findMany: jest.fn() },
            tick: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    handler = module.get(GetWorkspaceMarketQuotesQueryHandler);
    prisma = module.get(PrismaService);
  });

  it('1. should return empty array if workspace has no connectors', async () => {
    jest.spyOn(prisma.connector, 'findMany').mockResolvedValue([]);
    const result = await handler.execute(new GetWorkspaceMarketQuotesQuery('ws-1'));
    expect(result).toEqual([]);
    expect(prisma.connector.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1' }, select: { provider: true }});
  });

  it('2. should return latest quotes for authorized symbols', async () => {
    jest.spyOn(prisma.connector, 'findMany').mockResolvedValue([{ provider: 'MT5' }] as any);
    jest.spyOn(prisma.marketProvider, 'findMany').mockResolvedValue([{ id: 'prov-1', name: 'MT5' }] as any);
    jest.spyOn(prisma.symbol, 'findMany').mockResolvedValue([
      { id: 'sym-1', standardSymbol: 'EURUSD', brokerSymbol: 'EURUSD' }
    ] as any);

    const tickTime = new Date();
    jest.spyOn(prisma.tick, 'findMany').mockResolvedValue([
      { symbolId: 'sym-1', bid: 1.085, ask: 1.0852, timestamp: tickTime }
    ] as any);

    const result = await handler.execute(new GetWorkspaceMarketQuotesQuery('ws-1'));

    expect(prisma.tick.findMany).toHaveBeenCalledWith({
      where: { symbolId: { in: ['sym-1'] } },
      orderBy: { timestamp: 'desc' },
      distinct: ['symbolId'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbolId: 'sym-1',
      brokerSymbol: 'EURUSD',
      standardSymbol: 'EURUSD',
      bid: 1.085,
      ask: 1.0852,
      spread: 1.0852 - 1.085,
      timestamp: tickTime,
    });
  });
});
