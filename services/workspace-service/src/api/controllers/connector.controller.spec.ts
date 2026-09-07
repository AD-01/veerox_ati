import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorController } from './connector.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '../../infrastructure/auth/workspace-scope.guard';

describe('ConnectorController', () => {
  let controller: ConnectorController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    commandBus = { execute: jest.fn() } as unknown as jest.Mocked<CommandBus>;
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectorController],
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

    controller = module.get<ConnectorController>(ConnectorController);
  });

  describe('createConnector', () => {
    it('should extract actorId from request and dispatch CreateConnectorCommand', async () => {
      const mockRequest = { user: { userId: 'user-1' } } as unknown as Request;
      const dto = { name: 'Broker', provider: 'MT5' };
      
      commandBus.execute.mockResolvedValue('connector-1');
      
      const result = await controller.createConnector('org-1', 'workspace-1', dto, mockRequest);
      
      expect(result).toEqual({ id: 'connector-1' });
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          workspaceId: 'workspace-1',
          name: 'Broker',
          provider: 'MT5',
          actorId: 'user-1',
        })
      );
    });
  });
});
