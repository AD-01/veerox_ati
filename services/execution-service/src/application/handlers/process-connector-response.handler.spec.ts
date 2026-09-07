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
    expect(updateCall.where.status).toBe('DISPATCHED');
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
});
