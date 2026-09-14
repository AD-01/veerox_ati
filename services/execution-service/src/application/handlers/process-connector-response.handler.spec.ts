import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { ConnectorResponseReceivedEvent } from '@veerox/events';
import { ProcessConnectorResponseHandler } from './process-connector-response.handler';

describe('ProcessConnectorResponseHandler', () => {
  let handler: ProcessConnectorResponseHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let publisher: any;

  beforeEach(async () => {
    prisma = {
      connectorCommand: {
        findUnique: jest.fn(),
      },
      executionOrder: {
        findFirst: jest.fn(),
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
        ProcessConnectorResponseHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventPublisher, useValue: publisher },
        { provide: OutboxService, useValue: { saveEvents: jest.fn() } },
      ],
    }).compile();

    handler = module.get<ProcessConnectorResponseHandler>(ProcessConnectorResponseHandler);
  });

  it('should fill execution order on SUCCESS', async () => {
    const event = new ConnectorResponseReceivedEvent(
      'res-1', 'cmd-1', 'conn-1', 'SUCCESS', null, JSON.stringify({ executedPrice: 1.25 }), new Date()
    );

    prisma.connectorCommand.findUnique.mockResolvedValue({
      id: 'cmd-1',
      connectorId: 'conn-1',
    });

    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-1',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'DISPATCHED',
      connectorCommandId: 'cmd-1',
      size: 1.0,
    });

    await handler.handle(event);

    expect(prisma.executionOrder.updateMany).toHaveBeenCalled();
    const updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('FILLED');
    expect(updateCall.data.executedPrice).toBe(1.25);
    expect(updateCall.where.status).toEqual({ in: ['DISPATCHED', 'PARTIALLY_FILLED', 'AWAITING_RECONCILIATION'] });
  });

  it('should reject execution order on REJECTED', async () => {
    const event = new ConnectorResponseReceivedEvent(
      'res-1', 'cmd-1', 'conn-1', 'REJECTED', 'Insufficient margin', null, new Date()
    );

    prisma.connectorCommand.findUnique.mockResolvedValue({
      id: 'cmd-1',
      connectorId: 'conn-1',
    });

    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-1',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'DISPATCHED',
      connectorCommandId: 'cmd-1',
      size: 1.0,
    });

    await handler.handle(event);

    expect(prisma.executionOrder.updateMany).toHaveBeenCalled();
    const updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('REJECTED');
    expect(updateCall.data.failureReason).toBe('Insufficient margin');
  });
  
  it('should throw error if connector IDs mismatch', async () => {
    const event = new ConnectorResponseReceivedEvent(
      'res-1', 'cmd-1', 'forged-conn', 'SUCCESS', null, null, new Date()
    );

    prisma.connectorCommand.findUnique.mockResolvedValue({
      id: 'cmd-1',
      connectorId: 'conn-1',
    });

    await expect(handler.handle(event)).rejects.toThrow(/Connector Security Violation/);
    expect(prisma.executionOrder.updateMany).not.toHaveBeenCalled();
  });

  it('should_not_apply_same_execution_fill_twice', async () => {
    const event = new ConnectorResponseReceivedEvent(
      'res-2', 'cmd-2', 'conn-1', 'SUCCESS', null, JSON.stringify({ executedPrice: 1.25, brokerTicketId: 'ticket-1' }), new Date()
    );

    prisma.connectorCommand.findUnique.mockResolvedValue({
      id: 'cmd-2',
      connectorId: 'conn-1',
    });

    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-2',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'DISPATCHED',
      connectorCommandId: 'cmd-2',
      size: 1.0,
      remainingSize: 1.0,
    });

    // Mock executionFill.create to throw P2002 duplicate constraint
    prisma.executionFill = {
      create: jest.fn().mockRejectedValue({ code: 'P2002' }),
    };

    await handler.handle(event);

    expect(prisma.executionFill.create).toHaveBeenCalled();
    // Since it threw P2002, the transaction should be aborted/caught, and updateMany shouldn't be called
    expect(prisma.executionOrder.updateMany).not.toHaveBeenCalled();
  });

  it('should correctly track partial fills and remain filled on duplicate', async () => {
    const event1 = new ConnectorResponseReceivedEvent(
      'res-fill1', 'cmd-3', 'conn-1', 'PARTIALLY_FILLED', null, JSON.stringify({ executedPrice: 1.25, executedSize: 4, brokerTicketId: 'ticket-1' }), new Date()
    );

    prisma.connectorCommand.findUnique.mockResolvedValue({
      id: 'cmd-3',
      connectorId: 'conn-1',
    });

    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-3',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'DISPATCHED',
      connectorCommandId: 'cmd-3',
      size: 10.0,
      executedSize: 0,
      remainingSize: 10.0,
    });

    prisma.executionFill = {
      create: jest.fn().mockResolvedValue({}),
    };

    await handler.handle(event1);

    expect(prisma.executionOrder.updateMany).toHaveBeenCalled();
    let updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('PARTIALLY_FILLED');
    expect(updateCall.data.executedSize).toBe(4);
    expect(updateCall.data.remainingSize).toBe(6);

    // Fill 2: 3
    prisma.executionOrder.updateMany.mockClear();
    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-3',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'PARTIALLY_FILLED',
      connectorCommandId: 'cmd-3',
      size: 10.0,
      executedSize: 4,
      remainingSize: 6,
    });
    const event2 = new ConnectorResponseReceivedEvent(
      'res-fill2', 'cmd-3', 'conn-1', 'PARTIALLY_FILLED', null, JSON.stringify({ executedPrice: 1.25, executedSize: 3, brokerTicketId: 'ticket-2' }), new Date()
    );
    await handler.handle(event2);
    
    updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('PARTIALLY_FILLED');
    expect(updateCall.data.executedSize).toBe(7);
    expect(updateCall.data.remainingSize).toBe(3);

    // Fill 3: 3
    prisma.executionOrder.updateMany.mockClear();
    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-3',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'PARTIALLY_FILLED',
      connectorCommandId: 'cmd-3',
      size: 10.0,
      executedSize: 7,
      remainingSize: 3,
    });
    const event3 = new ConnectorResponseReceivedEvent(
      'res-fill3', 'cmd-3', 'conn-1', 'FILLED', null, JSON.stringify({ executedPrice: 1.25, executedSize: 3, brokerTicketId: 'ticket-3' }), new Date()
    );
    await handler.handle(event3);
    
    updateCall = prisma.executionOrder.updateMany.mock.calls[0][0];
    expect(updateCall.data.status).toBe('FILLED');
    expect(updateCall.data.executedSize).toBe(10);
    expect(updateCall.data.remainingSize).toBe(0);

    // Duplicate Fill 2 when order is already FILLED
    prisma.executionOrder.updateMany.mockClear();
    prisma.executionFill.create.mockRejectedValueOnce({ code: 'P2002' });
    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-3',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'FILLED',
      connectorCommandId: 'cmd-3',
      size: 10.0,
      executedSize: 10,
      remainingSize: 0,
    });
    const event2Dup = new ConnectorResponseReceivedEvent(
      'res-fill2', 'cmd-3', 'conn-1', 'PARTIALLY_FILLED', null, JSON.stringify({ executedPrice: 1.25, executedSize: 3, brokerTicketId: 'ticket-2' }), new Date()
    );
    
    // It should exit early because the order is FILLED, so it won't hit executionFill.create
    prisma.executionFill.create.mockClear();
    await handler.handle(event2Dup);
    expect(prisma.executionFill.create).not.toHaveBeenCalled();
    expect(prisma.executionOrder.updateMany).not.toHaveBeenCalled();

    // Now test duplicate 2 if the order was STILL partially filled (e.g., event3 hadn't arrived yet)
    prisma.executionOrder.findFirst.mockResolvedValue({
      id: 'ord-3',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      status: 'PARTIALLY_FILLED', // Simulate order state before fill 3
      connectorCommandId: 'cmd-3',
      size: 10.0,
      executedSize: 7,
      remainingSize: 3,
    });
    prisma.executionFill.create.mockRejectedValueOnce({ code: 'P2002' }); // P2002 will be thrown
    await handler.handle(event2Dup);

    // The duplicate was caught and dropped due to P2002
    expect(prisma.executionOrder.updateMany).not.toHaveBeenCalled(); 
  });
});
