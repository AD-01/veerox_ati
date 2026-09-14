import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PortfolioLedgerService } from '../portfolio-ledger.service';
import { TradingAccountAggregate } from '../../aggregates/trading-account.aggregate';
import { PositionAggregate } from '../../aggregates/position.aggregate';
import Decimal from 'decimal.js';

describe('PortfolioLedgerService (Unit)', () => {
  let service: PortfolioLedgerService;
  let publisher: EventPublisher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioLedgerService,
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn((obj) => {
              obj.commit = jest.fn();
              obj.apply = jest.fn();
              return obj;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioLedgerService>(PortfolioLedgerService);
    publisher = module.get<EventPublisher>(EventPublisher);
  });

  const createDummyAccount = () => {
    return new TradingAccountAggregate(
      'acc1',
      'org1',
      'ws1',
      'conn1',
      'USD',
      new Decimal(10000), // balance
      new Decimal(10000), // equity
      new Decimal(0),     // realizedPnl
      new Decimal(0),     // unrealizedPnl
      new Decimal(0),     // marginUsed
      new Decimal(10000), // freeMargin
      1                   // version
    );
  };

  it('NETTING: should process BUY 1.0, then SELL 0.4 resulting in BUY 0.6', () => {
    const account = createDummyAccount();
    
    // First fill: BUY 1.0
    const res1 = service.processFill(
      account,
      null,
      'EURUSD',
      100000,
      'BUY',
      1.0,
      1.1000,
      'corr1',
      'NETTING',
      'tk1'
    );

    expect(res1.positions.length).toBe(1);
    expect(res1.positions[0].side).toBe('BUY');
    expect(res1.positions[0].quantity.toNumber()).toBe(1.0);
    expect(res1.tradePnl.toNumber()).toBe(0);

    // Second fill: SELL 0.4
    const res2 = service.processFill(
      res1.account,
      res1.positions[0],
      'EURUSD',
      100000,
      'SELL',
      0.4,
      1.1050, // sold higher, profit
      'corr2',
      'NETTING',
      'tk2'
    );

    expect(res2.positions.length).toBe(1);
    expect(res2.positions[0].quantity.toNumber()).toBe(0.6);
    expect(res2.positions[0].status).toBe('OPEN');
    expect(res2.tradePnl.toNumber()).toBe(200); // (1.1050 - 1.1000) * 0.4 * 100000
    expect(res2.account.balance.toNumber()).toBe(10200); // 10000 + 200
  });

  it('NETTING: should process BUY 1.0, then SELL 1.0 resulting in CLOSED position', () => {
    const account = createDummyAccount();
    
    const pos = new PositionAggregate(
      'pos1',
      'org1',
      'ws1',
      'acc1',
      'EURUSD',
      'BUY',
      new Decimal(1.0),
      new Decimal(1.1000),
      new Decimal(0),
      new Decimal(0),
      'OPEN',
      new Date(),
      null,
      'corr1',
      1,
      'tk1',
      null
    );

    const res = service.processFill(
      account,
      pos,
      'EURUSD',
      100000,
      'SELL',
      1.0,
      1.0900, // sold lower, loss
      'corr2',
      'NETTING',
      'tk2'
    );

    expect(res.positions.length).toBe(1);
    expect(res.positions[0].quantity.toNumber()).toBe(0);
    expect(res.positions[0].status).toBe('CLOSED');
    expect(res.tradePnl.toNumber()).toBe(-1000); // (1.0900 - 1.1000) * 1.0 * 100000
    expect(res.account.balance.toNumber()).toBe(9000);
  });

  it('NETTING: should process BUY 1.0, then SELL 1.5 resulting in BUY closed and SELL 0.5 opened as reversal', () => {
    const account = createDummyAccount();
    
    const pos = new PositionAggregate(
      'pos1',
      'org1',
      'ws1',
      'acc1',
      'EURUSD',
      'BUY',
      new Decimal(1.0),
      new Decimal(1.1000),
      new Decimal(0),
      new Decimal(0),
      'OPEN',
      new Date(),
      null,
      'corr1',
      1,
      'tk1',
      null
    );

    const res = service.processFill(
      account,
      pos,
      'EURUSD',
      100000,
      'SELL',
      1.5,
      1.1020,
      'corr2',
      'NETTING',
      'tk2'
    );

    expect(res.positions.length).toBe(2);
    // First pos is closed
    expect(res.positions[0].id).toBe('pos1');
    expect(res.positions[0].quantity.toNumber()).toBe(0);
    expect(res.positions[0].status).toBe('CLOSED');
    // Second pos is new
    expect(res.positions[1].side).toBe('SELL');
    expect(res.positions[1].quantity.toNumber()).toBe(0.5);
    expect(res.positions[1].averageEntryPrice.toNumber()).toBe(1.1020);
    expect(res.positions[1].status).toBe('OPEN');

    expect(res.tradePnl.toNumber()).toBe(200); // (1.1020 - 1.1000) * 1.0 * 100000
    expect(res.account.balance.toNumber()).toBe(10200);
  });

  it('HEDGING: should process BUY 1.0, then BUY 0.5 as two independent positions', () => {
    const account = createDummyAccount();
    
    const pos = new PositionAggregate(
      'pos1',
      'org1',
      'ws1',
      'acc1',
      'EURUSD',
      'BUY',
      new Decimal(1.0),
      new Decimal(1.1000),
      new Decimal(0),
      new Decimal(0),
      'OPEN',
      new Date(),
      null,
      'corr1',
      1,
      'tk1',
      null
    );

    const res = service.processFill(
      account,
      pos,
      'EURUSD',
      100000,
      'BUY',
      0.5,
      1.1020,
      'corr2',
      'HEDGING',
      'tk2'
    );

    expect(res.positions.length).toBe(1); // Service returns ONLY the positions it mutated/created!
    expect(res.positions[0].id).not.toBe('pos1');
    expect(res.positions[0].side).toBe('BUY');
    expect(res.positions[0].quantity.toNumber()).toBe(0.5);
    expect(res.tradePnl.toNumber()).toBe(0);
    expect(res.account.balance.toNumber()).toBe(10000);
  });

  it('HEDGING: SELL 0.5 against a specific position', () => {
    const account = createDummyAccount();
    
    const pos = new PositionAggregate(
      'pos1',
      'org1',
      'ws1',
      'acc1',
      'EURUSD',
      'BUY',
      new Decimal(1.0),
      new Decimal(1.1000),
      new Decimal(0),
      new Decimal(0),
      'OPEN',
      new Date(),
      null,
      'corr1',
      1,
      'tk1',
      null
    );

    // If hedging, and we supply the specific position, it decreases it (closes the hedge)
    const res = service.processFill(
      account,
      pos, // we supply pos1
      'EURUSD',
      100000,
      'SELL',
      0.5,
      1.1040,
      'corr2',
      'HEDGING', // The mode doesn't prevent closing if we supply the specific position to close!
      'tk2'
    );

    expect(res.positions.length).toBe(1);
    expect(res.positions[0].id).toBe('pos1');
    expect(res.positions[0].quantity.toNumber()).toBe(0.5);
    expect(res.tradePnl.toNumber()).toBe(200); // (1.1040 - 1.1000) * 0.5 * 100000
  });
});
