import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { ExecutionOrderCreatedEvent } from '@veerox/events';
import { DispatchExecutionOrderHandler } from './dispatch-execution-order.handler';

describe('DispatchExecutionOrderHandler', () => {
  let handler: DispatchExecutionOrderHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let publisher: any;

  beforeEach(async () => {
    prisma = {
      tradingAccount: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ nextCommandSequence: 2 }), // Fixed for Track N
      },
      symbol: {
        findUnique: jest.fn(),
      },
      connectorCommand: {
        create: jest.fn(),
      },
      executionOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    publisher = {
      mergeObjectContext: jest.fn().mockImplementation((obj) => {
        obj.commit = jest.fn();
        obj.apply = jest.fn();
        return obj;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchExecutionOrderHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventPublisher, useValue: publisher },
        { provide: OutboxService, useValue: { saveEvents: jest.fn() } },
      ],
    }).compile();

    handler = module.get<DispatchExecutionOrderHandler>(DispatchExecutionOrderHandler);
  });

  it('should dispatch execution order and save connector command', async () => {
    const event = new ExecutionOrderCreatedEvent(
      'ord-1', 'ws-1', 'org-1', 'acc-1', 'sym-1', 'dec-1', 'cor-1', 'MARKET', 'BUY', 1.0, null, null, null, new Date()
    );

    prisma.tradingAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      connectorId: 'conn-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      executionHalted: false,
    });

    prisma.symbol.findUnique.mockResolvedValue({
      id: 'sym-1',
      brokerSymbol: 'EURUSD',
    });

    await handler.handle(event);

    expect(prisma.connectorCommand.create).toHaveBeenCalled();
    const createCall = prisma.connectorCommand.create.mock.calls[0][0];
    expect(createCall.data.connectorId).toBe('conn-1');
    expect(createCall.data.commandType).toBe('TRADE_EXECUTE'); 
    
    expect(prisma.executionOrder.updateMany).toHaveBeenCalled();
    const updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('DISPATCHED');
    expect(updateCall.where.status).toBe('PENDING');
  });

  it('Track H: should block financial execution if Kill Switch is active and emit AuditLog', async () => {
    const event = new ExecutionOrderCreatedEvent(
      'ord-ks', 'ws-1', 'org-1', 'acc-1', 'sym-1', 'dec-1', 'cor-ks', 'MARKET', 'BUY', 1.0, null, null, null, new Date()
    );

    prisma.tradingAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      connectorId: 'conn-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      executionHalted: true, // Kill Switch Active
    });

    await expect(handler.handle(event)).rejects.toThrow(/Execution halted/);

    // Should create an audit log
    expect(prisma.auditLog.create).toHaveBeenCalled();
    const auditCall = prisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('KILL_SWITCH_REJECTION');
    
    // Should NOT create connector command
    expect(prisma.connectorCommand.create).not.toHaveBeenCalled();
  });
});
