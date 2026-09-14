import { Test, TestingModule } from '@nestjs/testing';
import { TradingAccountController } from './trading-account.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';

describe('TradingAccountController', () => {
  let controller: TradingAccountController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    commandBus = { execute: jest.fn() } as unknown as jest.Mocked<CommandBus>;
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradingAccountController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(WorkspaceScopeGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TradingAccountController>(TradingAccountController);
  });

  describe('createTradingAccount', () => {
    it('should extract actorId from request and dispatch CreateTradingAccountCommand', async () => {
      const mockRequest = { user: { userId: 'user-1' } } as unknown as Request;
      const dto = {
        connectorId: 'conn-1',
        brokerName: 'Broker',
        brokerServer: 'Server',
        accountNumber: '123',
        accountName: 'Acc',
        accountType: 'REAL',
        leverage: '1:100',
        currency: 'USD',
        platform: 'MT5',
        terminalVersion: '1.0'
      };
      
      commandBus.execute.mockResolvedValue('account-1');
      
      const result = await controller.createTradingAccount('org-1', 'workspace-1', dto, mockRequest);
      
      expect(result).toEqual({ id: 'account-1' });
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          workspaceId: 'workspace-1',
          connectorId: 'conn-1',
          actorId: 'user-1',
        })
      );
    });
  });
});
