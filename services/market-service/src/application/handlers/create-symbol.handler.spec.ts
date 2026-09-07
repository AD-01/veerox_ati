/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { CreateSymbolHandler } from './create-symbol.handler';
import { CreateSymbolCommand } from '../commands/create-symbol.command';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';

describe('CreateSymbolHandler', () => {
  let handler: CreateSymbolHandler;
  let symbolRepository: any;
  let providerRepository: any;
  let auditRepository: any;
  let eventPublisher: any;
  let prisma: any;

  beforeEach(() => {
    symbolRepository = {
      save: jest.fn(),
    };
    providerRepository = {
      findById: jest.fn(),
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

    handler = new CreateSymbolHandler(
      symbolRepository,
      providerRepository,
      auditRepository,
      eventPublisher,
      prisma,
    );
  });

  it('should successfully create a symbol when actor is Platform Administrator', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    providerRepository.findById.mockResolvedValue({ id: 'prov-1' });

    const command = new CreateSymbolCommand('prov-1', 'BTCUSDT', 'BTCUSD', 'CRYPTO', 1, 0.01, 2, 'actor-1');
    const id = await handler.execute(command);

    expect(id).toBeDefined();
    expect(symbolRepository.save).toHaveBeenCalled();
    expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-1',
      action: 'CreateSymbol',
    }));
  });

  it('should deny unauthorized actor (e.g. Workspace A Admin)', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Workspace Admin' } }]);
    
    const command = new CreateSymbolCommand('prov-1', 'BTCUSDT', 'BTCUSD', 'CRYPTO', 1, 0.01, 2, 'actor-1');
    
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(symbolRepository.save).not.toHaveBeenCalled();
  });

  it('should reject invalid provider ID', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'Platform Administrator' } }]);
    providerRepository.findById.mockResolvedValue(null);
    
    const command = new CreateSymbolCommand('invalid-prov', 'BTCUSDT', 'BTCUSD', 'CRYPTO', 1, 0.01, 2, 'actor-1');
    
    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });
});
