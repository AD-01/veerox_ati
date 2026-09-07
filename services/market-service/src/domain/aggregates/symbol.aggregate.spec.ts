/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { SymbolAggregate } from './symbol.aggregate';

describe('SymbolAggregate', () => {
  it('should create a valid symbol', () => {
    const symbol = SymbolAggregate.create({
      providerId: 'prov-1',
      brokerSymbol: 'BTCUSDT',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      contractSize: 1,
      tickSize: 0.01,
      precision: 2,
    });

    expect(symbol.id).toBeDefined();
    expect(symbol.providerId).toBe('prov-1');
    expect(symbol.brokerSymbol).toBe('BTCUSDT');
    expect(symbol.contractSize).toBe(1);
  });

  it('should throw if contract size is zero or negative', () => {
    expect(() => SymbolAggregate.create({
      providerId: 'prov-1',
      brokerSymbol: 'BTCUSDT',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      contractSize: 0,
      tickSize: 0.01,
      precision: 2,
    })).toThrow('Contract size must be strictly positive.');
  });

  it('should reconstitute a symbol', () => {
    const date = new Date();
    const symbol = SymbolAggregate.reconstitute({
      id: 'sym-1',
      providerId: 'prov-1',
      brokerSymbol: 'BTCUSDT',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      contractSize: 1,
      tickSize: 0.01,
      precision: 2,
      status: 'ACTIVE',
      createdAt: date,
      updatedAt: date,
    });

    expect(symbol.id).toBe('sym-1');
  });
});
