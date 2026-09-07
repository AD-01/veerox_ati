import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionCompletedEventHandler } from '../../../src/application/handlers/execution-completed.event-handler';
import { ExecutionOrderCompletedEvent } from '@veerox/events';
import { TRADING_ACCOUNT_REPOSITORY } from '../../../src/infrastructure/repositories/trading-account.repository';
import { POSITION_REPOSITORY } from '../../../src/infrastructure/repositories/position.repository';
import { PortfolioLedgerService } from '../../../src/domain/services/portfolio-ledger.service';
import { PrismaService } from '@veerox/database';
import { EventPublisher } from '@nestjs/cqrs';
import { OutboxService } from '@veerox/shared';
import Decimal from 'decimal.js';

describe('ExecutionCompletedEventHandler', () => {
  let handler: ExecutionCompletedEventHandler;
  let ledgerService: PortfolioLedgerService;
  let prisma: PrismaService;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      symbol: { findUnique: jest.fn() },
      portfolioTransaction: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionCompletedEventHandler,
        {
          provide: TRADING_ACCOUNT_REPOSITORY,
          useValue: { findById: jest.fn(), save: jest.fn() },
        },
        {
          provide: POSITION_REPOSITORY,
          useValue: { findActiveBySymbol: jest.fn(), save: jest.fn() },
        },
        {
          provide: PortfolioLedgerService,
          useValue: { processFill: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
          },
        },
        {
          provide: EventPublisher,
          useValue: {},
        },
        {
          provide: OutboxService,
          useValue: { saveEvents: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get<ExecutionCompletedEventHandler>(ExecutionCompletedEventHandler);
    ledgerService = module.get<PortfolioLedgerService>(PortfolioLedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should skip if missing backward compatible params', async () => {
    const event = new ExecutionOrderCompletedEvent('ord-1', 'ws-1', 'org-1', 'acc-1', 50000, null, new Date());
    await handler.handle(event);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should process correctly with backward compatible params', async () => {
    const event = new ExecutionOrderCompletedEvent(
      'ord-1', 'ws-1', 'org-1', 'acc-1', 50000, null, new Date(),
      'sym-1', 'BUY', 1.0, 'corr-1'
    );
    
    const mockAccountRepo = handler['accountRepo'];
    const mockPositionRepo = handler['positionRepo'];

    const mockAccount = { organizationId: 'org-1', workspaceId: 'ws-1', currency: 'USD', balance: new Decimal(10000), commit: jest.fn() };
    mockAccountRepo.findById = jest.fn().mockResolvedValue(mockAccount);
    
    mockTx.symbol.findUnique.mockResolvedValue({ id: 'sym-1', contractSize: new Decimal(1) });
    mockPositionRepo.findActiveBySymbol = jest.fn().mockResolvedValue(null);

    const mockUpdatedAccount = { balance: new Decimal(10000), commit: jest.fn() };
    const mockUpdatedPosition = { id: 'pos-1', quantity: new Decimal(1.0), status: 'OPEN', commit: jest.fn() };
    
    ledgerService.processFill = jest.fn().mockReturnValue({
      account: mockUpdatedAccount,
      position: mockUpdatedPosition,
      tradePnl: new Decimal(0),
    });

    await handler.handle(event);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mockTx.portfolioTransaction.create).toHaveBeenCalled();
    expect(mockPositionRepo.save).toHaveBeenCalled();
    expect(mockAccountRepo.save).toHaveBeenCalled();
    expect(mockTx.auditLog.create).toHaveBeenCalled();
  });
});
