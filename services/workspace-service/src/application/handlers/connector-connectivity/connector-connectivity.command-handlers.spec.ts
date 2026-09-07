import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { AUDIT_REPOSITORY } from '../../../application/ports/audit.repository.interface';
import { CONNECTOR_REPOSITORY } from '../../../domain/repositories/connector.repository.interface';
import {
  ReceiveConnectorHeartbeatHandler,
  ClaimPendingCommandHandler,
  SubmitCommandResponseHandler,
  CheckStaleConnectorsHandler,
} from './connector-connectivity.command-handlers';
import {
  ReceiveConnectorHeartbeatCommand,
  ClaimPendingCommandCommand,
  SubmitCommandResponseCommand,
  CheckStaleConnectorsCommand,
} from '../../commands/connector-connectivity.commands';
import { Connector, ConnectorConnectionStatus } from '../../../domain/aggregates/connector.aggregate';

describe('Connector Connectivity Handlers', () => {
  let heartbeatHandler: ReceiveConnectorHeartbeatHandler;
  let claimHandler: ClaimPendingCommandHandler;
  let submitResponseHandler: SubmitCommandResponseHandler;
  let checkStaleHandler: CheckStaleConnectorsHandler;

  const mockPrisma = {
    connectorHealth: { create: jest.fn() },
    connectorCommand: { findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    connectorResponse: { create: jest.fn() },
    connector: { findMany: jest.fn() },
  };

  const mockConnectorRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockAuditRepo = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiveConnectorHeartbeatHandler,
        ClaimPendingCommandHandler,
        SubmitCommandResponseHandler,
        CheckStaleConnectorsHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: CONNECTOR_REPOSITORY, useValue: mockConnectorRepo },
      ],
    }).compile();

    heartbeatHandler = module.get(ReceiveConnectorHeartbeatHandler);
    claimHandler = module.get(ClaimPendingCommandHandler);
    submitResponseHandler = module.get(SubmitCommandResponseHandler);
    checkStaleHandler = module.get(CheckStaleConnectorsHandler);

    jest.clearAllMocks();
  });

  describe('ReceiveConnectorHeartbeatHandler', () => {
    it('should throw if connector not found', async () => {
      mockConnectorRepo.findById.mockResolvedValueOnce(null);
      await expect(
        heartbeatHandler.execute(new ReceiveConnectorHeartbeatCommand('c1', 'o1', 'w1', { timestamp: new Date(), agentVersion: '1.0' }))
      ).rejects.toThrow('Connector not found');
    });

    it('should process heartbeat and optionally save health', async () => {
      const connector = Connector.create('c1', 'o1', 'w1', 'Name', 'MT5');
      // mock the internal state update for simplicity
      jest.spyOn(connector, 'heartbeat').mockImplementation(() => {});

      mockConnectorRepo.findById.mockResolvedValueOnce(connector);

      await heartbeatHandler.execute(
        new ReceiveConnectorHeartbeatCommand('c1', 'o1', 'w1', {
          timestamp: new Date(),
          agentVersion: '1.0',
          health: { cpuUsage: 50 },
        })
      );

      expect(connector.heartbeat).toHaveBeenCalledWith('1.0');
      expect(mockConnectorRepo.save).toHaveBeenCalledWith(connector);
      expect(mockPrisma.connectorHealth.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cpuUsage: 50 }),
        })
      );
    });
  });

  describe('ClaimPendingCommandHandler', () => {
    it('should return null if no pending commands found', async () => {
      mockPrisma.connectorCommand.findFirst.mockResolvedValueOnce(null);
      const result = await claimHandler.execute(new ClaimPendingCommandCommand('c1', 'o1', 'w1'));
      expect(result).toBeNull();
    });

    it('should return null if updateMany returns 0 count', async () => {
      mockPrisma.connectorCommand.findFirst.mockResolvedValueOnce({ id: 'cmd-1' });
      mockPrisma.connectorCommand.updateMany.mockResolvedValueOnce({ count: 0 }); // concurrent claim
      const result = await claimHandler.execute(new ClaimPendingCommandCommand('c1', 'o1', 'w1'));
      expect(result).toBeNull();
    });

    it('should return claimed command on success', async () => {
      mockPrisma.connectorCommand.findFirst.mockResolvedValueOnce({ id: 'cmd-1' });
      mockPrisma.connectorCommand.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.connectorCommand.findUnique.mockResolvedValueOnce({ id: 'cmd-1', status: 'CLAIMED' });

      const result = await claimHandler.execute(new ClaimPendingCommandCommand('c1', 'o1', 'w1'));
      expect(result).toEqual({ id: 'cmd-1', status: 'CLAIMED' });
    });
  });

  describe('SubmitCommandResponseHandler', () => {
    it('should throw if command not found or not claimed', async () => {
      mockPrisma.connectorCommand.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(
        submitResponseHandler.execute(
          new SubmitCommandResponseCommand('c1', 'o1', 'w1', 'cmd-1', { responseCode: 'OK', responseMessage: null, payloadJson: null })
        )
      ).rejects.toThrow('Command not found, not claimed, or already processed');
    });

    it('should insert response and log audit on success', async () => {
      mockPrisma.connectorCommand.updateMany.mockResolvedValueOnce({ count: 1 });

      await submitResponseHandler.execute(
        new SubmitCommandResponseCommand('c1', 'o1', 'w1', 'cmd-1', { responseCode: 'OK', responseMessage: 'Success', payloadJson: '{}' })
      );

      expect(mockPrisma.connectorResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ responseCode: 'OK' })
        })
      );
      expect(mockAuditRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONNECTOR_COMMAND_RESPONDED' })
      );
    });
  });

  describe('CheckStaleConnectorsHandler', () => {
    it('should disconnect stale connectors', async () => {
      mockPrisma.connector.findMany.mockResolvedValueOnce([
        { id: 'c1', organizationId: 'o1', workspaceId: 'w1' }
      ]);
      const connector = Connector.create('c1', 'o1', 'w1', 'Name', 'MT5');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (connector as any).props.connectionStatus = ConnectorConnectionStatus.CONNECTED;

      jest.spyOn(connector, 'disconnect');
      mockConnectorRepo.findById.mockResolvedValueOnce(connector);

      await checkStaleHandler.execute(new CheckStaleConnectorsCommand(300));

      expect(connector.disconnect).toHaveBeenCalledWith('STALE_HEARTBEAT_TIMEOUT');
      expect(mockConnectorRepo.save).toHaveBeenCalledWith(connector);
    });
  });
});
