import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { ReconcilePortfolioHandler } from '../reconcile-portfolio.handler';
import { ReconcilePortfolioCommand } from '../../commands/reconcile-portfolio.command';

describe('ReconcilePortfolioHandler', () => {
  let handler: ReconcilePortfolioHandler;
  let prisma: PrismaService;
  let publisher: EventPublisher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconcilePortfolioHandler,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb({
              portfolioReconciliationSnapshot: {
                findUnique: jest.fn(),
                create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
              },
              position: {
                findMany: jest.fn(),
              },
              tradingAccount: {
                findUnique: jest.fn(),
              },
              portfolioReconciliationDiscrepancy: {
                create: jest.fn(),
              },
              outboxMessage: {
                create: jest.fn(),
              },
              auditLog: {
                create: jest.fn(),
              },
            })),
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<ReconcilePortfolioHandler>(ReconcilePortfolioHandler);
    prisma = module.get<PrismaService>(PrismaService);
    publisher = module.get<EventPublisher>(EventPublisher);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should detect mismatches correctly and emit anomalies', async () => {
    // Arrange
    const txMock = {
      portfolioReconciliationSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      executionOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      position: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'pos-1', symbolId: 'sym-1', side: 'BUY', quantity: 2, averageEntryPrice: 100 },
        ]),
      },
      tradingAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', balance: 1000, equity: 1000 }),
      },
      portfolioReconciliationDiscrepancy: {
        create: jest.fn(),
      },
      outboxMessage: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(txMock));

    const command = new ReconcilePortfolioCommand(
      'org-1',
      'ws-1',
      'acc-1',
      'ext-snap-1',
      new Date(),
      [
        { symbolId: 'sym-1', side: 'BUY', quantity: 1, averageEntryPrice: 100 }, // Size mismatch
        { symbolId: 'sym-2', side: 'SELL', quantity: 5, averageEntryPrice: 50 }, // Missing in internal
      ],
      1000, // Balance matches
      1000, // Equity matches
      0,
      1000,
    );

    // Act
    await handler.execute(command);

    // Assert
    expect(txMock.portfolioReconciliationDiscrepancy.create).toHaveBeenCalledTimes(2);
    expect(txMock.outboxMessage.create).toHaveBeenCalledTimes(3); // 2 discrepancies + 1 completed event
    expect(txMock.portfolioReconciliationSnapshot.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ANOMALIES_DETECTED' }),
    }));
  });

  it('Case A: matching broker execution exists -> FILLED', async () => {
    const txMock = {
      portfolioReconciliationSnapshot: { 
        create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      position: { findMany: jest.fn().mockResolvedValue([]) },
      tradingAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', balance: 1000, equity: 1000 }) },
      executionOrder: { 
        findMany: jest.fn().mockResolvedValue([{ id: 'order-1', status: 'AWAITING_RECONCILIATION', requestedPrice: 1.1000, size: 1.0 }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      executionFill: { create: jest.fn() },
      portfolioTransaction: { create: jest.fn() },
      portfolioReconciliationDiscrepancy: { create: jest.fn() },
      outboxMessage: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(txMock));

    const command = new ReconcilePortfolioCommand('org-1', 'ws-1', 'acc-1', 'ext-snap-1', new Date(), [
      { clientExecutionId: 'order-1', quantity: 1.0, averageEntryPrice: 1.1000, side: 'BUY' as any, symbolId: 'sym-1' } as any
    ], 1000, 1000, 0, 1000);

    await handler.execute(command);

    expect(txMock.executionOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1', status: 'AWAITING_RECONCILIATION' },
      data: expect.objectContaining({ status: 'FILLED', executedSize: 1.0, executedPrice: 1.1000 })
    }));
    expect(txMock.executionFill.create).toHaveBeenCalled();
  });

  it('Case B: opening trade absent after grace period -> FAILED', async () => {
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 10);
    
    const txMock = {
      portfolioReconciliationSnapshot: { 
        create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      position: { findMany: jest.fn().mockResolvedValue([]) },
      tradingAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', balance: 1000, equity: 1000 }) },
      executionOrder: { 
        findMany: jest.fn().mockResolvedValue([{ id: 'order-2', status: 'AWAITING_RECONCILIATION', createdAt: pastDate }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      executionFill: { create: jest.fn() },
      portfolioTransaction: { create: jest.fn() },
      portfolioReconciliationDiscrepancy: { create: jest.fn() },
      outboxMessage: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(txMock));

    const command = new ReconcilePortfolioCommand('org-1', 'ws-1', 'acc-1', 'ext-snap-1', new Date(), [], 1000, 1000, 0, 1000);

    await handler.execute(command);

    expect(txMock.executionOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-2', status: 'AWAITING_RECONCILIATION' },
      data: expect.objectContaining({ status: 'FAILED' })
    }));
    expect(txMock.executionFill.create).not.toHaveBeenCalled();
    expect(txMock.portfolioTransaction.create).not.toHaveBeenCalled();
  });
});
