/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { ProcessMarketDataHandler } from './process-market-data.handler';
import { ProcessMarketDataCommand } from '../commands/process-market-data.command';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('ProcessMarketDataHandler', () => {
  let handler: ProcessMarketDataHandler;
  let symbolRepository: any;
  let eventPublisher: any;
  let prisma: any;

  beforeEach(() => {
    symbolRepository = {
      findByBrokerSymbol: jest.fn(),
    };
    eventPublisher = {
      publish: jest.fn(),
    };
    prisma = {
      userRole: {
        findMany: jest.fn(),
      },
    };

    handler = new ProcessMarketDataHandler(symbolRepository, eventPublisher, prisma);
  });

  it('should successfully emit event when actor is Platform Administrator', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    symbolRepository.findByBrokerSymbol.mockResolvedValue({
      id: 'sym-123',
      standardSymbol: 'BTCUSD',
    });

    const command = new ProcessMarketDataCommand(
      'prov-1', 'BTCUSDT', new Date().toISOString(), '1m', 100, 105, 95, 102, 1000, true, 'actor-1'
    );
    await handler.execute(command);

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'market.data.updated',
      expect.objectContaining({
        symbolId: 'sym-123',
      })
    );
  });

  it('should deny unauthorized actor', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Trader' } }]);
    const command = new ProcessMarketDataCommand(
      'prov-1', 'BTCUSDT', new Date().toISOString(), '1m', 100, 105, 95, 102, 1000, true, 'actor-1'
    );
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
