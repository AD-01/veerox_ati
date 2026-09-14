import { SubmitManualTradeHandler } from './submit-manual-trade.handler';
import { SubmitManualTradeCommand } from '../commands/submit-manual-trade.command';
import { Prisma } from '@veerox/database';
const Decimal = Prisma.Decimal;

describe('SubmitManualTradeHandler', () => {
  let handler: SubmitManualTradeHandler;
  let prismaMock: any;
  let publisherMock: any;
  let outboxServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      executionOrder: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tick: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };
    publisherMock = {
      mergeObjectContext: jest.fn().mockImplementation((obj) => {
        obj.commit = jest.fn();
        return obj;
      }),
    };
    outboxServiceMock = {
      saveEvents: jest.fn(),
    };

    handler = new SubmitManualTradeHandler(prismaMock, publisherMock, outboxServiceMock);
    
    // Mock risk response to always approve
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ decisionOutcome: 'APPROVED', permittedSize: 1.0 })
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createCommand = (overrides: Partial<SubmitManualTradeCommand> = {}) => {
    return new SubmitManualTradeCommand(
      'workspace-1',
      'org-1',
      'user-1',
      'account-1',
      'symbol-1',
      'BUY',
      1.0,
      'MARKET',
      null,
      null,
      'client-exec-1',
      'auth-token-1',
      overrides.requestedPrice,
      overrides.maxDeviation
    );
  };

  const createTick = (ask: number, bid: number, timestamp: Date, tickSize: number = 0.0001) => ({
    ask: new Decimal(ask),
    bid: new Decimal(bid),
    timestamp,
    symbol: { tickSize: new Decimal(tickSize) }
  });

  describe('Tick Freshness', () => {
    it('should reject stale tick', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(createTick(1.1000, 1.0998, new Date(Date.now() - 6000)));

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: 'STALE_MARKET_DATA: Market data is older than 5000ms threshold.'
        })
      }));
    });

    it('should accept fresh tick (4999ms)', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(createTick(1.1000, 1.0998, new Date(Date.now() - 4999)));

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
        })
      }));
    });

    it('should reject tick older than 5000ms (5001ms)', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(createTick(1.1000, 1.0998, new Date(Date.now() - 5001)));

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: 'STALE_MARKET_DATA: Market data is older than 5000ms threshold.'
        })
      }));
    });

    it('should reject future tick', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(createTick(1.1000, 1.0998, new Date(Date.now() + 1000)));

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: 'FUTURE_MARKET_DATA: Tick timestamp is in the future.'
        })
      }));
    });

    it('should reject missing tick', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(null);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: 'No market data available to validate slippage.'
        })
      }));
    });
  });

  describe('Slippage & Deviation Bounds', () => {
    const validTick = createTick(1.1005, 1.0995, new Date(), 0.0001); // maxAllowed = 0.1

    it('should reject negative maxDeviation', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: -0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          failureReason: expect.stringContaining('INVALID_DEVIATION')
        })
      }));
    });

    it('should reject excessive maxDeviation', async () => {
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 999999 });
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          failureReason: expect.stringContaining('INVALID_DEVIATION')
        })
      }));
    });

    it('BUY: accept within tolerance', async () => {
      // requested = 1.1000, dev = 0.0010, ask = 1.1005. 1.1005 < 1.1010 (ok)
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0010 });
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' })
      }));
    });

    it('BUY: reject outside tolerance', async () => {
      // requested = 1.1000, dev = 0.0002, ask = 1.1005. 1.1005 > 1.1002 (fail)
      const cmd = createCommand({ requestedPrice: 1.1000, maxDeviation: 0.0002 });
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: expect.stringContaining('PRICE_TOLERANCE_EXCEEDED')
        })
      }));
    });

    it('SELL: accept within tolerance', async () => {
      // requested = 1.1000, dev = 0.0010, bid = 1.0995. 1.0995 > 1.0990 (ok)
      const cmd = new SubmitManualTradeCommand(
        'w1', 'o1', 'u1', 'a1', 's1', 'SELL', 1.0, 'MARKET', null, null, 'id1', 'auth1', 1.1000, 0.0010
      );
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' })
      }));
    });

    it('SELL: reject outside tolerance', async () => {
      // requested = 1.1000, dev = 0.0002, bid = 1.0995. 1.0995 < 1.0998 (fail)
      const cmd = new SubmitManualTradeCommand(
        'w1', 'o1', 'u1', 'a1', 's1', 'SELL', 1.0, 'MARKET', null, null, 'id1', 'auth1', 1.1000, 0.0002
      );
      prismaMock.tick.findFirst.mockResolvedValue(validTick);

      await handler.execute(cmd);

      expect(prismaMock.executionOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          failureReason: expect.stringContaining('PRICE_TOLERANCE_EXCEEDED')
        })
      }));
    });
  });
});
