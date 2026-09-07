/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { CreateMarketProviderHandler } from './create-market-provider.handler';
import { CreateMarketProviderCommand } from '../commands/create-market-provider.command';
import { UnauthorizedException } from '@nestjs/common';
import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';

describe('CreateMarketProviderHandler', () => {
  let handler: CreateMarketProviderHandler;
  let repository: any;
  let auditRepository: any;
  let eventPublisher: any;
  let prisma: any;

  beforeEach(() => {
    repository = {
      findByName: jest.fn(),
      save: jest.fn(),
    };
    auditRepository = {
      log: jest.fn(),
    };
    eventPublisher = {
      publish: jest.fn(),
    };
    prisma = {
      userRole: {
        findMany: jest.fn(),
      },
    };

    handler = new CreateMarketProviderHandler(repository, auditRepository, eventPublisher, prisma);
  });

  it('should successfully create a market provider when actor is Platform Administrator', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    repository.findByName.mockResolvedValue(null);

    const command = new CreateMarketProviderCommand('Binance', 'CRYPTO', '{}', 'actor-123');
    const id = await handler.execute(command);

    expect(id).toBeDefined();
    expect(repository.save).toHaveBeenCalled();
    expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-123',
      action: 'CreateMarketProvider',
    }));
  });

  it('should deny unauthenticated or unauthorized actor (e.g. Org A Admin)', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Organization Admin' }, organizationId: 'org-A' }]);
    
    const command = new CreateMarketProviderCommand('Binance', 'CRYPTO', '{}', 'actor-123');
    
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(auditRepository.log).not.toHaveBeenCalled();
  });

  it('should deny cross-organization manipulation (e.g. Org A actor trying to mutate global resource)', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Trader' }, organizationId: 'org-A' }]);
    
    const command = new CreateMarketProviderCommand('Oanda', 'FOREX', '{}', 'actor-123');
    
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
  });
});
