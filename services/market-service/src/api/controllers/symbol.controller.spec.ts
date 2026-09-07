/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { SymbolController } from './symbol.controller';
import { CreateSymbolCommand } from '../../application/commands/create-symbol.command';
import { ProcessMarketDataCommand } from '../../application/commands/process-market-data.command';

describe('SymbolController', () => {
  let controller: SymbolController;
  let commandBus: any;

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };
    controller = new SymbolController(commandBus);
  });

  it('should dispatch CreateSymbolCommand with actorId from req.user', async () => {
    commandBus.execute.mockResolvedValue('sym-id');
    const req = { user: { userId: 'actor-1' } } as any;
    
    const result = await controller.createSymbol({ 
      providerId: 'p-1', brokerSymbol: 'BTC', standardSymbol: 'BTC', assetType: 'CRYPTO', tickSize: 0.1, precision: 2, contractSize: 1 
    }, req);
    
    expect(result).toEqual({ id: 'sym-id' });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(CreateSymbolCommand)
    );
    expect(commandBus.execute.mock.calls[0][0].actorId).toBe('actor-1');
  });

  it('should dispatch ProcessMarketDataCommand with actorId from req.user', async () => {
    commandBus.execute.mockResolvedValue(undefined);
    const req = { user: { userId: 'actor-1' } } as any;
    
    const result = await controller.processMarketData('p-1', 'BTC', { 
      timestamp: new Date().toISOString(), timeframe: '1m', open: 1, high: 2, low: 0, close: 1.5, volume: 100, isClosed: true 
    }, req);
    
    expect(result).toEqual({ success: true });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(ProcessMarketDataCommand)
    );
    expect(commandBus.execute.mock.calls[0][0].actorId).toBe('actor-1');
  });
});
