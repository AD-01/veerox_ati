import { EventBus } from '@nestjs/cqrs';
import { CreateTradingAccountHandler, UpdateAccountStatisticsHandler, SyncOpenPositionsHandler } from './trading-account.command-handlers';
import { PrismaTradingAccountRepository } from '../../../infrastructure/repositories/prisma-trading-account.repository';
import { PrismaConnectorRepository } from '../../../infrastructure/repositories/prisma-connector.repository';
import { IAuditRepository } from '../../ports/audit.repository.interface';
import { CreateTradingAccountCommand, UpdateAccountStatisticsCommand, SyncOpenPositionsCommand } from '../../commands/trading-account.commands';
import { Connector } from '../../../domain/aggregates/connector.aggregate';
import { TradingAccount } from '../../../domain/aggregates/trading-account.aggregate';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@veerox/database';

describe('TradingAccount Command Handlers', () => {
  let repository: jest.Mocked<PrismaTradingAccountRepository>;
  let connectorRepository: jest.Mocked<PrismaConnectorRepository>;
  let auditRepository: jest.Mocked<IAuditRepository>;
  let eventBus: jest.Mocked<EventBus>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    repository = { save: jest.fn(), findById: jest.fn() } as unknown as jest.Mocked<PrismaTradingAccountRepository>;
    connectorRepository = { findById: jest.fn() } as unknown as jest.Mocked<PrismaConnectorRepository>;
    auditRepository = { log: jest.fn() } as unknown as jest.Mocked<IAuditRepository>;
    eventBus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    prismaService = {
      accountStatistics: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb({
        openPositionReadModel: {
          deleteMany: jest.fn(),
          upsert: jest.fn(),
        }
      })),
    } as unknown as jest.Mocked<PrismaService>;
  });

  describe('CreateTradingAccountHandler', () => {
    it('should reject if connector does not belong to the same organization and workspace', async () => {
      connectorRepository.findById.mockResolvedValue(null);

      const handler = new CreateTradingAccountHandler(repository, connectorRepository, auditRepository, eventBus);
      const command = new CreateTradingAccountCommand(
        'org-1', 'workspace-1', 'conn-1', 'Broker', 'Server', '123', 'Acc', 'REAL', '1:100', 'USD', 'MT5', '1.0', 'user-1'
      );

      await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    });

    it('should create account and log audit if connector is valid', async () => {
      const connector = Connector.create('conn-1', 'org-1', 'workspace-1', 'Broker', 'MT5');
      connectorRepository.findById.mockResolvedValue(connector);

      const handler = new CreateTradingAccountHandler(repository, connectorRepository, auditRepository, eventBus);
      const command = new CreateTradingAccountCommand(
        'org-1', 'workspace-1', 'conn-1', 'Broker', 'Server', '123', 'Acc', 'REAL', '1:100', 'USD', 'MT5', '1.0', 'user-1'
      );

      await handler.execute(command);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'user-1',
        action: 'CreateTradingAccount',
      }));
    });
  });

  describe('UpdateAccountStatisticsHandler', () => {
    it('should throw if account is not found', async () => {
      repository.findById.mockResolvedValue(null);

      const handler = new UpdateAccountStatisticsHandler(repository, auditRepository, eventBus, prismaService);
      const command = new UpdateAccountStatisticsCommand('acc-1', 'org-1', 'ws-1', 1000, 1000, 0, 1000, 0, 0, 'user-1');

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should update statistics and calculate new peak equity', async () => {
      const account = TradingAccount.create('acc-1', 'org-1', 'ws-1', 'conn-1', 'Broker', 'Server', '123', 'Acc', 'REAL', '1:100', 'USD', 'MT5', '1.0');
      repository.findById.mockResolvedValue(account);

      (prismaService.accountStatistics.findFirst as jest.Mock).mockResolvedValue({
        peakEquity: 1200,
      });

      const handler = new UpdateAccountStatisticsHandler(repository, auditRepository, eventBus, prismaService);
      const command = new UpdateAccountStatisticsCommand('acc-1', 'org-1', 'ws-1', 1000, 1500, 0, 1500, 0, 500, 'user-1');

      await handler.execute(command);

      expect(prismaService.accountStatistics.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          equity: 1500,
          peakEquity: 1500, // 1500 > 1200
        }),
      }));

      expect(repository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('SyncOpenPositionsHandler', () => {
    it('should throw if account not found', async () => {
      repository.findById.mockResolvedValue(null);

      const handler = new SyncOpenPositionsHandler(repository, eventBus, prismaService);
      const command = new SyncOpenPositionsCommand('acc-1', 'org-1', 'ws-1', [], 'user-1');

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should sync positions and emit event', async () => {
      const account = TradingAccount.create('acc-1', 'org-1', 'ws-1', 'conn-1', 'Broker', 'Server', '123', 'Acc', 'REAL', '1:100', 'USD', 'MT5', '1.0');
      repository.findById.mockResolvedValue(account);

      (prismaService.accountStatistics.findFirst as jest.Mock).mockResolvedValue({
        equity: 1500,
        margin: 500,
        freeMargin: 1000,
        peakEquity: 1500,
      });

      const handler = new SyncOpenPositionsHandler(repository, eventBus, prismaService);
      const positions = [{
        id: 'pos-1', symbolId: 'sym-1', status: 'OPEN', size: 1.0, direction: 'LONG', openPrice: 1.0, currentPrice: 1.1, marginUsed: 100,
      }];
      const command = new SyncOpenPositionsCommand('acc-1', 'org-1', 'ws-1', positions, 'user-1');

      await handler.execute(command);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.accountStatistics.findFirst).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });
});
