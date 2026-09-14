import { Test, TestingModule } from '@nestjs/testing';
import { LiveRunnerService } from './live-runner.service';
import { PrismaService } from '@veerox/database';
import { StrategyFactory } from '../strategies/strategy.factory';
import { StrategyOrchestrationRepository } from '../../infrastructure/repositories/strategy-orchestration.repository';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';

describe('LiveRunnerService', () => {
  let service: LiveRunnerService;
  let prisma: jest.Mocked<PrismaService>;
  let strategyFactory: jest.Mocked<StrategyFactory>;
  let orchestrationRepo: jest.Mocked<StrategyOrchestrationRepository>;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaMock: any = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: jest.fn(async (cb: any) => {
        return cb(prismaMock);
      }),
      outboxMessage: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      strategy: {
        findUnique: jest.fn(),
      },
      tradingAccount: {
        findFirst: jest.fn(),
      },
      openPositionReadModel: {
        findMany: jest.fn(),
      }
    };

    const strategyFactoryMock = {
      create: jest.fn(),
    };

    const orchestrationRepoMock = {
      findActiveOrchestrations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveRunnerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StrategyFactory, useValue: strategyFactoryMock },
        { provide: StrategyOrchestrationRepository, useValue: orchestrationRepoMock },
        { provide: OpenPositionRepository, useValue: { findByWorkspaceAndSymbol: jest.fn() } },
      ],
    }).compile();

    service = module.get<LiveRunnerService>(LiveRunnerService);
    prisma = module.get(PrismaService);
    strategyFactory = module.get(StrategyFactory);
    orchestrationRepo = module.get(StrategyOrchestrationRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMarketDataUpdate', () => {
    it('should ignore non-closed candles', async () => {
      await service.processMarketDataUpdate('sym1', 'M1', new Date(), 1, 1, 1, 1, 1, false);
      expect(orchestrationRepo.findActiveOrchestrations).not.toHaveBeenCalled();
    });

    it('should process closed candles and emit outbox message on strategy signal', async () => {
      orchestrationRepo.findActiveOrchestrations.mockResolvedValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { workspaceId: 'ws1', currentStrategyId: 'strat1', currentExpertAdvisorId: null } as any
      ]);

      (prisma.outboxMessage.findFirst as jest.Mock).mockResolvedValue(null);
      
      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue({
        id: 'strat1',
        name: 'MA_CROSS',
        organizationId: 'org1',
        status: 'ACTIVE',
      });

      (prisma.tradingAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'acc1',
        balance: { toNumber: () => 10000 },
        equity: { toNumber: () => 10000 },
        marginUsed: { toNumber: () => 0 },
      });

      (prisma.openPositionReadModel.findMany as jest.Mock).mockResolvedValue([]);

      const mockStrategy = {
        onCandle: jest.fn().mockReturnValue({
          action: 'OPEN',
          symbol: 'sym1',
          direction: 'BUY',
          lotSize: 0.1,
        })
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strategyFactory.create.mockReturnValue(mockStrategy as any);

      await service.processMarketDataUpdate('sym1', 'M1', new Date(), 1.1, 1.2, 1.0, 1.15, 100, true);

      expect(prisma.outboxMessage.create).toHaveBeenCalled();
      const createArgs = (prisma.outboxMessage.create as jest.Mock).mock.calls[0][0];
      
      expect(createArgs.data.eventType).toBe('TradingOpportunityGeneratedEvent');
      expect(createArgs.data.payload.direction).toBe('LONG');
    });

    it('should safely ignore P2002 error from concurrent duplicate execution', async () => {
      orchestrationRepo.findActiveOrchestrations.mockResolvedValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { workspaceId: 'ws1', currentStrategyId: 'strat1', currentExpertAdvisorId: null } as any
      ]);

      (prisma.strategy.findUnique as jest.Mock).mockResolvedValue({
        id: 'strat1',
        name: 'MA_CROSS',
        organizationId: 'org1',
        status: 'ACTIVE',
      });

      (prisma.tradingAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'acc1',
        balance: { toNumber: () => 10000 },
        equity: { toNumber: () => 10000 },
        marginUsed: { toNumber: () => 0 },
      });

      (prisma.openPositionReadModel.findMany as jest.Mock).mockResolvedValue([]);

      const mockStrategy = {
        onCandle: jest.fn().mockReturnValue({
          action: 'OPEN',
          symbol: 'sym1',
          direction: 'BUY',
          lotSize: 0.1,
        })
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      strategyFactory.create.mockReturnValue(mockStrategy as any);

      // Simulate concurrent duplicate violation during create
      (prisma.outboxMessage.create as jest.Mock).mockRejectedValue({
        code: 'P2002',
        meta: { target: ['idempotency_key'] }
      });

      // Should not throw, should safely exit
      await expect(
        service.processMarketDataUpdate('sym1', 'M1', new Date(), 1, 1, 1, 1, 100, true)
      ).resolves.toBeUndefined();
      
      expect(prisma.outboxMessage.create).toHaveBeenCalled();
    });

    it('should propagate non-P2002 database errors', async () => {
      orchestrationRepo.findActiveOrchestrations.mockResolvedValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { workspaceId: 'ws1', currentStrategyId: 'strat1', currentExpertAdvisorId: null } as any
      ]);

      (prisma.strategy.findUnique as jest.Mock).mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.processMarketDataUpdate('sym1', 'M1', new Date(), 1, 1, 1, 1, 100, true)
      ).rejects.toThrow('Connection lost');
    });
  });
});
