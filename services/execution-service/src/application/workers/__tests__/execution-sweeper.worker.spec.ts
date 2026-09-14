import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { ExecutionSweeperWorker } from '../execution-sweeper.worker';

describe('ExecutionSweeperWorker', () => {
  let worker: ExecutionSweeperWorker;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionSweeperWorker,
        {
          provide: PrismaService,
          useValue: {
            executionOrder: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            outboxMessage: {
              create: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb({
              executionOrder: {
                updateMany: jest.fn(),
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
      ],
    }).compile();

    worker = module.get<ExecutionSweeperWorker>(ExecutionSweeperWorker);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should not sweep if no stale orders found', async () => {
    (prisma.executionOrder.findMany as jest.Mock).mockResolvedValue([]);
    await worker.sweepStaleOrders();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should sweep stale orders and emit events', async () => {
    const mockOrder = {
      id: 'order-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      correlationId: 'corr-1',
      status: 'PENDING',
    };

    (prisma.executionOrder.findMany as jest.Mock).mockResolvedValue([mockOrder]);
    
    const txMock = {
      executionOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      outboxMessage: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(txMock));

    await worker.sweepStaleOrders();

    expect(txMock.executionOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'order-1',
        status: { in: ['PENDING', 'DISPATCHED'] },
      },
      data: expect.objectContaining({
        status: 'AWAITING_RECONCILIATION',
        failureReason: 'CONNECTOR_TIMEOUT',
      }),
    }));

    expect(txMock.outboxMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aggregateType: 'ExecutionOrder',
        aggregateId: 'order-1',
        eventType: 'ExecutionOrderUncertainEvent',
      }),
    }));
  });

  it('should not emit event if another worker already claimed the order', async () => {
    const mockOrder = {
      id: 'order-1',
      status: 'PENDING',
    };

    (prisma.executionOrder.findMany as jest.Mock).mockResolvedValue([mockOrder]);
    
    const txMock = {
      executionOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // Claim failed
      },
      outboxMessage: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(txMock));

    await worker.sweepStaleOrders();

    expect(txMock.executionOrder.updateMany).toHaveBeenCalled();
    expect(txMock.outboxMessage.create).not.toHaveBeenCalled(); // Should not emit
  });
});
