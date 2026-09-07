/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { MarketProviderRepository } from './market-provider.repository';
import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';

describe('MarketProviderRepository', () => {
  let repository: MarketProviderRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      marketProvider: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    repository = new MarketProviderRepository(prisma);
  });

  it('should save a new provider', async () => {
    const provider = MarketProviderAggregate.create({ name: 'Binance', type: 'CRYPTO', config: '{}' });
    
    await repository.save(provider);
    
    expect(prisma.marketProvider.upsert).toHaveBeenCalled();
  });

  it('should save an existing provider (update)', async () => {
    const provider = MarketProviderAggregate.create({ name: 'Binance', type: 'CRYPTO', config: '{}' });
    
    await repository.save(provider);
    
    expect(prisma.marketProvider.upsert).toHaveBeenCalled();
  });

  it('should find by id', async () => {
    const date = new Date();
    prisma.marketProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      name: 'Binance',
      type: 'CRYPTO',
      config: '{}',
      createdAt: date,
      updatedAt: date,
    });
    
    const provider = await repository.findById('prov-1');
    expect(provider).toBeDefined();
    expect(provider?.id).toBe('prov-1');
  });

  it('should find by name', async () => {
    const date = new Date();
    prisma.marketProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      name: 'Binance',
      type: 'CRYPTO',
      config: '{}',
      createdAt: date,
      updatedAt: date,
    });
    
    const provider = await repository.findByName('Binance');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('Binance');
  });
});

