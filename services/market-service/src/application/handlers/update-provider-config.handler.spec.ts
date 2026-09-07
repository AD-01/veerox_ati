/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { UpdateProviderConfigHandler } from './update-provider-config.handler';
import { UpdateProviderConfigCommand } from '../commands/update-provider-config.command';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';

describe('UpdateProviderConfigHandler', () => {
  let handler: UpdateProviderConfigHandler;
  let repository: any;
  let auditRepository: any;
  let prisma: any;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    auditRepository = {
      log: jest.fn(),
    };
    prisma = {
      userRole: {
        findMany: jest.fn(),
      },
    };

    handler = new UpdateProviderConfigHandler(repository, auditRepository, prisma);
  });

  it('should successfully update a market provider when actor is Platform Administrator', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    const provider = MarketProviderAggregate.create({ name: 'Binance', type: 'CRYPTO', config: '{}' });
    repository.findById.mockResolvedValue(provider);

    const command = new UpdateProviderConfigCommand(provider.id, '{"new": "config"}', 'actor-123');
    await handler.execute(command);

    expect(repository.save).toHaveBeenCalled();
    expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-123',
      action: 'UpdateMarketProviderConfig',
    }));
  });

  it('should deny unauthorized actor (e.g. Org A Admin)', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Organization Admin' }, organizationId: 'org-A' }]);
    
    const command = new UpdateProviderConfigCommand('provider-id', '{"new": "config"}', 'actor-123');
    
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject invalid target resource', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    repository.findById.mockResolvedValue(null);
    
    const command = new UpdateProviderConfigCommand('invalid-id', '{}', 'actor-123');
    
    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });
});
