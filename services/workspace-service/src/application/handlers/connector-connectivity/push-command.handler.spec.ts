import { PushCommandHandler } from './push-command.handler';
import { ConnectorCommandIssuedEvent } from '@veerox/events';

describe('PushCommandHandler', () => {
  let handler: PushCommandHandler;
  let gatewayMock: any;
  let prismaMock: any;
  let txMock: any;

  beforeEach(() => {
    gatewayMock = {
      pushCommand: jest.fn(),
    };
    txMock = {
      connectorCommand: { updateMany: jest.fn() },
      executionOrder: { updateMany: jest.fn(), findUnique: jest.fn() },
      outboxMessage: { create: jest.fn() },
    };
    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txMock)),
    };

    handler = new PushCommandHandler(gatewayMock, prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should push command if not expired', async () => {
    const event = new ConnectorCommandIssuedEvent(
      'cmd-1', 'conn-1', 'w-1', 'TRADE_EXECUTE', '{}', new Date(), new Date(Date.now() + 10000)
    );

    await handler.handle(event);

    expect(gatewayMock.pushCommand).toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should atomically expire command and emit outbox event if expired', async () => {
    const event = new ConnectorCommandIssuedEvent(
      'cmd-1', 'conn-1', 'w-1', 'TRADE_EXECUTE', '{"orderId":"order-1"}', new Date(), new Date(Date.now() - 10000)
    );

    txMock.connectorCommand.updateMany.mockResolvedValue({ count: 1 });
    txMock.executionOrder.updateMany.mockResolvedValue({ count: 1 });
    txMock.executionOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'EXPIRED' });

    await handler.handle(event);

    expect(txMock.connectorCommand.updateMany).toHaveBeenCalledWith({
      where: { id: 'cmd-1', status: 'PENDING' },
      data: { status: 'EXPIRED' }
    });
    
    expect(txMock.executionOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: { in: ['PENDING', 'DISPATCHED'] } },
      data: { status: 'EXPIRED', failureReason: 'Command TTL expired before dispatch' }
    });

    expect(txMock.outboxMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aggregateType: 'ExecutionOrder',
        eventType: 'OrderStateChanged'
      })
    }));

    expect(gatewayMock.pushCommand).not.toHaveBeenCalled();
  });

  it('should not emit outbox event if order status transition fails (concurrently filled)', async () => {
    const event = new ConnectorCommandIssuedEvent(
      'cmd-1', 'conn-1', 'w-1', 'TRADE_EXECUTE', '{"orderId":"order-1"}', new Date(), new Date(Date.now() - 10000)
    );

    txMock.connectorCommand.updateMany.mockResolvedValue({ count: 1 });
    txMock.executionOrder.updateMany.mockResolvedValue({ count: 0 }); // No rows updated because it wasn't PENDING/DISPATCHED

    await handler.handle(event);

    expect(txMock.outboxMessage.create).not.toHaveBeenCalled();
    expect(gatewayMock.pushCommand).not.toHaveBeenCalled();
  });
});
