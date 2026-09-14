import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorResponseController } from './connector-response.controller';
import { ProcessConnectorResponseHandler } from '../../application/handlers/process-connector-response.handler';
import { RmqContext } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

describe('ConnectorResponseController', () => {
  let controller: ConnectorResponseController;
  let handler: jest.Mocked<ProcessConnectorResponseHandler>;
  let channelMock: any;
  let rmqContextMock: any;
  let originalMsg: any;

  beforeEach(async () => {
    handler = {
      handle: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectorResponseController],
      providers: [
        {
          provide: ProcessConnectorResponseHandler,
          useValue: handler,
        },
      ],
    }).compile();

    controller = module.get<ConnectorResponseController>(ConnectorResponseController);
    
    // Suppress expected error logs during testing
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const confirmChannelMock = {
      sendToQueue: jest.fn((queue, content, options, cb) => {
        cb(null); // Simulate immediate success
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    channelMock = {
      ack: jest.fn(),
      nack: jest.fn(),
      connection: {
        createConfirmChannel: jest.fn().mockResolvedValue(confirmChannelMock),
      },
    };

    originalMsg = {
      content: Buffer.from('test'),
      fields: {
        routingKey: 'execution_queue',
      },
      properties: {
        headers: {},
      },
    };

    rmqContextMock = {
      getChannelRef: jest.fn().mockReturnValue(channelMock),
      getMessage: jest.fn().mockReturnValue(originalMsg),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getPayload = () => ({
    responseId: 'resp-1',
    commandId: 'cmd-1',
    connectorId: 'conn-1',
    responseCode: 'SUCCESS',
    responseMessage: 'OK',
    payloadJson: '{}',
    receivedAt: new Date().toISOString(),
  });

  it('TEST 1 — SUCCESS: message processed successfully -> ACK occurs -> no DLQ', async () => {
    handler.handle.mockResolvedValue(undefined);

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(channelMock.ack).toHaveBeenCalledWith(originalMsg);
    expect(channelMock.nack).not.toHaveBeenCalled();
  });

  it('TEST 2 — HANDLER FAILURE: permanent failure -> message is NOT ACKed but NACKed to DLQ', async () => {
    handler.handle.mockRejectedValue(new Error('Some permanent business error'));

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(channelMock.ack).not.toHaveBeenCalled();
    expect(channelMock.nack).toHaveBeenCalledWith(originalMsg, false, false);
  });

  it('TEST 3 — TRANSIENT FAILURE: simulate temporary DB/infrastructure failure -> message is retried', async () => {
    const transientError = new Error('Connection timeout');
    (transientError as any).code = 'P1001'; // Prisma transient code
    handler.handle.mockRejectedValue(transientError);

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    const confirmChannel = await channelMock.connection.createConfirmChannel();
    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(confirmChannel.sendToQueue).toHaveBeenCalledWith(
      'execution_retry_queue',
      originalMsg.content,
      { headers: { 'x-retry-count': 1 } },
      expect.any(Function)
    );
    expect(channelMock.ack).toHaveBeenCalledWith(originalMsg); // Original is ACKed to remove from front of queue
    expect(channelMock.nack).not.toHaveBeenCalled();
  });

  it('TEST 4 — RETRY EXHAUSTION: bounded retries -> DLQ', async () => {
    const transientError = new Error('Connection timeout');
    (transientError as any).code = 'P1001';
    handler.handle.mockRejectedValue(transientError);

    // Simulate 5 prior retries
    originalMsg.properties.headers['x-retry-count'] = 5;

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(channelMock.connection.createConfirmChannel).not.toHaveBeenCalled(); // Max retries reached
    expect(channelMock.nack).toHaveBeenCalledWith(originalMsg, false, false); // DLQ
    expect(channelMock.ack).not.toHaveBeenCalled();
  });

  it('TEST 5 — POISON MESSAGE: malformed/permanent message -> no infinite retry -> DLQ', async () => {
    const poisonError = new Error('Malformed JSON');
    handler.handle.mockRejectedValue(poisonError);

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(channelMock.connection.createConfirmChannel).not.toHaveBeenCalled(); // Not transient
    expect(channelMock.nack).toHaveBeenCalledWith(originalMsg, false, false); // Routes to DLQ
    expect(channelMock.ack).not.toHaveBeenCalled();
  });

  it('TEST 6 — NEGATIVE HEADER SPOOFING: should sanitize negative x-retry-count', async () => {
    const transientError = new Error('Connection timeout');
    (transientError as any).code = 'P1001';
    handler.handle.mockRejectedValue(transientError);

    // Malicious producer tries to send negative retry count to bypass limits
    originalMsg.properties.headers['x-retry-count'] = -10000;

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    const confirmChannel = await channelMock.connection.createConfirmChannel();
    expect(confirmChannel.sendToQueue).toHaveBeenCalledWith(
      'execution_retry_queue',
      originalMsg.content,
      { headers: { 'x-retry-count': 1 } }, // Should sanitize negative to 0 and increment to 1
      expect.any(Function)
    );
  });

  it('TEST 7 — CONFIRMCHANNEL GUARANTEE: publish rejection closes channel and prevents ACK', async () => {
    const transientError = new Error('Connection timeout');
    (transientError as any).code = 'P1001';
    handler.handle.mockRejectedValue(transientError);

    // Override the mock to simulate broker rejecting the publish
    const confirmChannelMock = await channelMock.connection.createConfirmChannel();
    confirmChannelMock.sendToQueue.mockImplementationOnce((queue: string, content: any, options: any, cb: any) => {
      cb(new Error('Broker rejected publish'));
    });

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(confirmChannelMock.sendToQueue).toHaveBeenCalled();
    // CRITICAL: Must not ACK if publish failed
    expect(channelMock.ack).not.toHaveBeenCalled();
    // CRITICAL: Must close channel even on failure
    expect(confirmChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('TEST 8 — CONFIRMCHANNEL GUARANTEE: close() failure logs safely without breaking ACK', async () => {
    const transientError = new Error('Connection timeout');
    (transientError as any).code = 'P1001';
    handler.handle.mockRejectedValue(transientError);

    const confirmChannelMock = await channelMock.connection.createConfirmChannel();
    // Simulate close() throwing an error
    confirmChannelMock.close.mockRejectedValueOnce(new Error('Channel already closed by broker'));

    await controller.handleConnectorResponse(getPayload(), rmqContextMock as RmqContext);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(confirmChannelMock.sendToQueue).toHaveBeenCalled();
    // ACK should still have been called because publish succeeded before close() was called
    expect(channelMock.ack).toHaveBeenCalledWith(originalMsg);
    // Ensure close was attempted
    expect(confirmChannelMock.close).toHaveBeenCalledTimes(1);
  });
});
