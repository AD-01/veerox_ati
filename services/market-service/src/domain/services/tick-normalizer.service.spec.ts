import { TickNormalizerService } from './tick-normalizer.service';
import { RawTick } from '../../application/ports/market-provider.adapter.interface';

describe('TickNormalizerService', () => {
  let service: TickNormalizerService;

  beforeEach(() => {
    service = new TickNormalizerService();
  });

  const mockSymbolConfig = {
    id: 'symbol-1',
    providerId: 'provider-1',
    brokerSymbol: 'EURUSD',
    standardSymbol: 'EURUSD',
    assetType: 'FOREX',
    tickSize: 0.00001,
    precision: 5,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should normalize a valid tick', () => {
    const rawTick: RawTick = {
      symbol: 'EURUSD',
      bid: 1.105432,
      ask: 1.105541,
      volume: 1.5,
      timestamp: new Date(),
    };

    const result = service.normalize(rawTick, mockSymbolConfig as unknown as import('../aggregates/symbol.aggregate').SymbolAggregate);

    expect(result).toBeDefined();
    expect(result!.symbolId).toBe('symbol-1');
    expect(result!.bid).toBe(1.10543);
    expect(result!.ask).toBe(1.10554);
    expect(result!.volume).toBe(1.5);
  });

  it('should return null for tick with negative prices', () => {
    const rawTick: RawTick = {
      symbol: 'EURUSD',
      bid: -1.10543,
      ask: 1.10554,
      volume: 1.5,
      timestamp: new Date(),
    };

    const result = service.normalize(rawTick, mockSymbolConfig as unknown as import('../aggregates/symbol.aggregate').SymbolAggregate);
    expect(result).toBeNull();
  });

  it('should return null for tick with negative spread', () => {
    const rawTick: RawTick = {
      symbol: 'EURUSD',
      bid: 1.10554,
      ask: 1.10543, // ask < bid
      volume: 1.5,
      timestamp: new Date(),
    };

    const result = service.normalize(rawTick, mockSymbolConfig as unknown as import('../aggregates/symbol.aggregate').SymbolAggregate);
    expect(result).toBeNull();
  });
});
