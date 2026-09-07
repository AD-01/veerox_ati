/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { MarketProviderController } from './market-provider.controller';
import { CreateMarketProviderCommand } from '../../application/commands/create-market-provider.command';
import { UpdateProviderConfigCommand } from '../../application/commands/update-provider-config.command';

describe('MarketProviderController', () => {
  let controller: MarketProviderController;
  let commandBus: any;

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };
    controller = new MarketProviderController(commandBus);
  });

  it('should dispatch CreateMarketProviderCommand with actorId from req.user', async () => {
    commandBus.execute.mockResolvedValue('prov-id');
    const req = { user: { userId: 'actor-1' } } as any;
    
    const result = await controller.createProvider({ name: 'Binance', type: 'CRYPTO', config: '{}' }, req);
    
    expect(result).toEqual({ id: 'prov-id' });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(CreateMarketProviderCommand)
    );
    expect(commandBus.execute.mock.calls[0][0].actorId).toBe('actor-1');
  });

  it('should dispatch UpdateProviderConfigCommand with actorId from req.user', async () => {
    commandBus.execute.mockResolvedValue(undefined);
    const req = { user: { userId: 'actor-1' } } as any;
    
    const result = await controller.updateConfig('prov-id', { config: '{"new":"yes"}' }, req);
    
    expect(result).toEqual({ success: true });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(UpdateProviderConfigCommand)
    );
    expect(commandBus.execute.mock.calls[0][0].actorId).toBe('actor-1');
  });
});
