/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { SymbolRepository } from './symbol.repository';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';

describe('SymbolRepository', () => {
  let repository: SymbolRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      symbol: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    repository = new SymbolRepository(prisma);
  });

  it('should save a new symbol', async () => {
    const symbol = SymbolAggregate.create({ 
      providerId: 'prov-1', brokerSymbol: 'BTC', standardSymbol: 'BTCUSD', assetType: 'CRYPTO', tickSize: 0.1, precision: 2, contractSize: 1
    });
    
    await repository.save(symbol);
    
    expect(prisma.symbol.upsert).toHaveBeenCalled();
  });

  it('should save an existing symbol (update)', async () => {
    const symbol = SymbolAggregate.create({ 
      providerId: 'prov-1', brokerSymbol: 'BTC', standardSymbol: 'BTCUSD', assetType: 'CRYPTO', tickSize: 0.1, precision: 2, contractSize: 1
    });
    
    await repository.save(symbol);
    
    expect(prisma.symbol.upsert).toHaveBeenCalled();
  });

  it('should find by id', async () => {
    const date = new Date();
    prisma.symbol.findUnique.mockResolvedValue({
      id: 'sym-1',
      providerId: 'prov-1',
      brokerSymbol: 'BTC',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      tickSize: 0.1,
      precision: 2,
      contractSize: 1,
      createdAt: date,
      updatedAt: date,
    });
    
    const symbol = await repository.findById('sym-1');
    expect(symbol).toBeDefined();
    expect(symbol?.id).toBe('sym-1');
  });

  it('should find by provider and broker symbol', async () => {
    const date = new Date();
    prisma.symbol.findUnique.mockResolvedValue({
      id: 'sym-1',
      providerId: 'prov-1',
      brokerSymbol: 'BTC',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      tickSize: 0.1,
      precision: 2,
      contractSize: 1,
      createdAt: date,
      updatedAt: date,
    });
    
    const symbol = await repository.findByBrokerSymbol('prov-1', 'BTC');
    expect(symbol).toBeDefined();
    expect(symbol?.id).toBe('sym-1');
  });

  it('should find by standard symbol', async () => {
    const date = new Date();
    prisma.symbol.findMany.mockResolvedValue([{
      id: 'sym-1',
      providerId: 'prov-1',
      brokerSymbol: 'BTC',
      standardSymbol: 'BTCUSD',
      assetType: 'CRYPTO',
      tickSize: 0.1,
      precision: 2,
      contractSize: 1,
      createdAt: date,
      updatedAt: date,
    }]);
    
    const symbols = await repository.findByStandardSymbol('BTCUSD');
    expect(symbols.length).toBe(1);
    expect(symbols[0].standardSymbol).toBe('BTCUSD');
  });
});

