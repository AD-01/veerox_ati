/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { MarketProviderAggregate } from './market-provider.aggregate';

describe('MarketProviderAggregate', () => {
  it('should create a valid market provider', () => {
    const provider = MarketProviderAggregate.create({
      name: 'Binance',
      type: 'CRYPTO',
      config: '{"apiKey":"123"}',
    });

    expect(provider.id).toBeDefined();
    expect(provider.name).toBe('Binance');
    expect(provider.type).toBe('CRYPTO');
    expect(provider.config).toBe('{"apiKey":"123"}');
  });

  it('should reconstitute a market provider', () => {
    const date = new Date();
    const provider = MarketProviderAggregate.reconstitute({
      id: 'prov-1',
      name: 'Binance',
      type: 'CRYPTO',
      config: '{}',
      status: 'ACTIVE',
      createdAt: date,
      updatedAt: date,
    });

    expect(provider.id).toBe('prov-1');
  });

  it('should update config successfully', () => {
    const provider = MarketProviderAggregate.create({
      name: 'Binance',
      type: 'CRYPTO',
      config: '{"old":"val"}',
    });

    provider.updateConfig('{"new":"val"}');
    expect(provider.config).toBe('{"new":"val"}');
  });
});
