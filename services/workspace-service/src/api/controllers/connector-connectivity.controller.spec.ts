import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorConnectivityController } from './connector-connectivity.controller';
import { CommandBus } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { 
  ReceiveConnectorHeartbeatCommand, 
  ClaimPendingCommandCommand, 
} from '../../application/commands/connector-connectivity.commands';

describe('ConnectorConnectivityController', () => {
  let controller: ConnectorConnectivityController;

  const mockCommandBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectorConnectivityController],
      providers: [
        {
          provide: CommandBus,
          useValue: mockCommandBus,
        },
      ],
    }).compile();

    controller = module.get<ConnectorConnectivityController>(ConnectorConnectivityController);
    
    jest.clearAllMocks();
  });

  describe('Tenant Validation', () => {
    it('should throw UnauthorizedException if token tenant does not match route params', async () => {
      const req = {
        user: {
          connectorId: 'connector-1',
          organizationId: 'org-1',
          workspaceId: 'workspace-1',
          type: 'connector'
        }
      } as unknown as Request;

      await expect(
        controller.heartbeat('org-1', 'workspace-2', 'connector-1', {}, req)
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.heartbeat('org-2', 'workspace-1', 'connector-1', {}, req)
      ).rejects.toThrow(UnauthorizedException);
      
      await expect(
        controller.heartbeat('org-1', 'workspace-1', 'connector-2', {}, req)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should proceed if token tenant matches route params', async () => {
      const req = {
        user: {
          connectorId: 'connector-1',
          organizationId: 'org-1',
          workspaceId: 'workspace-1',
          type: 'connector'
        }
      } as unknown as Request;

      await controller.heartbeat('org-1', 'workspace-1', 'connector-1', { agentVersion: '1.0' }, req);
      
      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.any(ReceiveConnectorHeartbeatCommand)
      );
    });
  });

  describe('heartbeat', () => {
    it('should execute ReceiveConnectorHeartbeatCommand with health payload', async () => {
      const req = {
        user: {
          connectorId: 'c1',
          organizationId: 'o1',
          workspaceId: 'w1',
          type: 'connector'
        }
      } as unknown as Request;

      await controller.heartbeat('o1', 'w1', 'c1', { 
        agentVersion: '1.0.0',
        health: { cpuUsage: 10 }
      }, req);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorId: 'c1',
          organizationId: 'o1',
          workspaceId: 'w1',
          payload: expect.objectContaining({
            agentVersion: '1.0.0',
            health: { cpuUsage: 10 }
          })
        })
      );
    });
  });

  describe('getPendingCommands', () => {
    it('should execute ClaimPendingCommandCommand and return command', async () => {
      const req = {
        user: {
          connectorId: 'c1',
          organizationId: 'o1',
          workspaceId: 'w1',
          type: 'connector'
        }
      } as unknown as Request;

      mockCommandBus.execute.mockResolvedValueOnce({ id: 'cmd-1', payloadJson: '{}' });

      const result = await controller.getPendingCommands('o1', 'w1', 'c1', req);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.any(ClaimPendingCommandCommand)
      );
      expect(result).toEqual({ command: { id: 'cmd-1', payloadJson: '{}' } });
    });

    it('should return null if no commands pending', async () => {
      const req = {
        user: {
          connectorId: 'c1',
          organizationId: 'o1',
          workspaceId: 'w1',
          type: 'connector'
        }
      } as unknown as Request;

      mockCommandBus.execute.mockResolvedValueOnce(null);
      const result = await controller.getPendingCommands('o1', 'w1', 'c1', req);
      expect(result).toEqual({ command: null });
    });
  });

  describe('submitCommandResponse', () => {
    it('should execute SubmitCommandResponseCommand', async () => {
      const req = {
        user: {
          connectorId: 'c1',
          organizationId: 'o1',
          workspaceId: 'w1',
          type: 'connector'
        }
      } as unknown as Request;

      await controller.submitCommandResponse('o1', 'w1', 'c1', 'cmd-1', {
        responseCode: 'OK',
        responseMessage: 'Success',
        payloadJson: '{"key": "value"}'
      }, req);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorId: 'c1',
          commandId: 'cmd-1',
          payload: {
            responseCode: 'OK',
            responseMessage: 'Success',
            payloadJson: '{"key": "value"}'
          }
        })
      );
    });
  });
});
