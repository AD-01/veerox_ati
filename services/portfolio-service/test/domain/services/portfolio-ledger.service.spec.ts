import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioLedgerService } from '../../../src/domain/services/portfolio-ledger.service';
import { EventPublisher } from '@nestjs/cqrs';
import { TradingAccountAggregate } from '../../../src/domain/aggregates/trading-account.aggregate';
import { PositionAggregate } from '../../../src/domain/aggregates/position.aggregate';
import Decimal from 'decimal.js';

describe('PortfolioLedgerService', () => {
  let service: PortfolioLedgerService;
  let publisher: EventPublisher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioLedgerService,
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn().mockImplementation((obj) => obj),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioLedgerService>(PortfolioLedgerService);
    publisher = module.get<EventPublisher>(EventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processFill', () => {
    it('1. First positions[0] open (Buy 1.0)', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000), new Decimal(10000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );

      const result = service.processFill(account, null, 'sym-1', 1, 'BUY', 1.0, 50000, 'corr-1');

      expect(result.positions[0].side).toBe('BUY');
      expect(result.positions[0].quantity.toNumber()).toBe(1.0);
      expect(result.positions[0].averageEntryPrice.toNumber()).toBe(50000);
      expect(result.tradePnl.toNumber()).toBe(0);
    });

    it('2. Additional same-side fill (Buy 0.5)', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000), new Decimal(10000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );

      const openPosition = new PositionAggregate(
        'pos-1', 'org-1', 'ws-1', 'acc-1', 'sym-1', 'BUY',
        new Decimal(1.0), new Decimal(50000), new Decimal(0), new Decimal(0), 'OPEN', new Date(), null, null, 1
      );

      const result = service.processFill(account, openPosition, 'sym-1', 1, 'BUY', 0.5, 60000, 'corr-2');

      expect(result.positions[0].quantity.toNumber()).toBe(1.5);
      // (1*50000 + 0.5*60000) / 1.5 = (50000 + 30000)/1.5 = 80000/1.5 = 53333.33333333
      expect(result.positions[0].averageEntryPrice.toNumber()).toBeCloseTo(53333.33333333);
      expect(result.tradePnl.toNumber()).toBe(0);
    });

    it('6. Reversal (Sell 1.5 against Buy 1.0)', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000), new Decimal(10000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );
      
      const openPosition = PositionAggregate.create(
        'pos-1', 'org-1', 'ws-1', 'acc-1', 'sym-1', 'BUY', new Decimal(1.0), new Decimal(50000), 'corr-6'
      );

      const result = service.processFill(account, openPosition, 'sym-1', 1, 'SELL', 1.5, 40000, 'corr-7');
      
      expect(result.positions).toHaveLength(2);
      expect(result.positions[0].status).toBe('CLOSED');
      expect(result.positions[1].status).toBe('OPEN');
      expect(result.positions[1].side).toBe('SELL');
      expect(result.positions[1].quantity.toNumber()).toBe(0.5);
    });

    it('3. Partial close (Sell 0.5)', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000), new Decimal(10000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );
      account.apply = jest.fn();

      const openPosition = new PositionAggregate(
        'pos-1', 'org-1', 'ws-1', 'acc-1', 'sym-1', 'BUY',
        new Decimal(1.0), new Decimal(50000), new Decimal(0), new Decimal(0), 'OPEN', new Date(), null, null, 1
      );
      openPosition.apply = jest.fn();

      const result = service.processFill(account, openPosition, 'sym-1', 1, 'SELL', 0.5, 60000, 'corr-3');

      expect(result.positions[0].quantity.toNumber()).toBe(0.5);
      expect(result.positions[0].status).toBe('OPEN');
      // Realized PnL = (60000 - 50000) * 0.5 * 1 = 5000
      expect(result.tradePnl.toNumber()).toBe(5000);
      expect(result.account.balance.toNumber()).toBe(15000); // 10000 + 5000
    });

    it('4. Full close (Sell 1.0)', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000), new Decimal(10000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );
      account.apply = jest.fn();

      const openPosition = new PositionAggregate(
        'pos-1', 'org-1', 'ws-1', 'acc-1', 'sym-1', 'BUY',
        new Decimal(1.0), new Decimal(50000), new Decimal(0), new Decimal(0), 'OPEN', new Date(), null, null, 1
      );
      openPosition.apply = jest.fn();

      const result = service.processFill(account, openPosition, 'sym-1', 1, 'SELL', 1.0, 40000, 'corr-4');

      expect(result.positions[0].quantity.toNumber()).toBe(0);
      expect(result.positions[0].status).toBe('CLOSED');
      // Realized PnL = (40000 - 50000) * 1.0 * 1 = -10000
      expect(result.tradePnl.toNumber()).toBe(-10000);
      expect(result.account.balance.toNumber()).toBe(0); // 10000 - 10000
    });

    it('5. Decimal precision preservation', () => {
      const account = new TradingAccountAggregate(
        'acc-1', 'org-1', 'ws-1', 'conn-1', 'USD',
        new Decimal(10000.00000000), new Decimal(10000.00000000), new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(10000), 1
      );
      const openPosition = new PositionAggregate(
        'pos-1', 'org-1', 'ws-1', 'acc-1', 'sym-1', 'BUY',
        new Decimal(1.00000001), new Decimal(50000.12345678), new Decimal(0), new Decimal(0), 'OPEN', new Date(), null, null, 1
      );
      
      const result = service.processFill(account, openPosition, 'sym-1', 1, 'SELL', 1.00000001, 60000.87654321, 'corr-5');

      expect(result.positions[0].quantity.toNumber()).toBe(0);
      const expectedPnl = new Decimal(60000.87654321).minus(new Decimal(50000.12345678)).mul(new Decimal(1.00000001));
      expect(result.tradePnl.toNumber()).toBe(expectedPnl.toNumber());
      expect(result.account.balance.toNumber()).toBe(new Decimal(10000).plus(expectedPnl).toNumber());
    });
  });
});
