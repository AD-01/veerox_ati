import { EventBus } from '@nestjs/cqrs';
import { CreateConnectorHandler, UpdateConnectorHandler, ArchiveConnectorHandler } from './connector.command-handlers';
import { PrismaConnectorRepository } from '../../../infrastructure/repositories/prisma-connector.repository';
import { IAuditRepository } from '../../ports/audit.repository.interface';
import { CreateConnectorCommand, UpdateConnectorCommand, ArchiveConnectorCommand } from '../../commands/connector.commands';
import { Connector } from '../../../domain/aggregates/connector.aggregate';
import { NotFoundException } from '@nestjs/common';

describe('Connector Command Handlers', () => {
  let repository: jest.Mocked<PrismaConnectorRepository>;
  let auditRepository: jest.Mocked<IAuditRepository>;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<PrismaConnectorRepository>;

    auditRepository = {
      log: jest.fn(),
    } as unknown as jest.Mocked<IAuditRepository>;

    eventBus = {
      publish: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;
  });

  describe('CreateConnectorHandler', () => {
    it('should create connector and generate audit log', async () => {
      const handler = new CreateConnectorHandler(repository, auditRepository, eventBus);
      const command = new CreateConnectorCommand('org-1', 'workspace-1', 'Test Broker', 'MT5', 'user-1');

      const id = await handler.execute(command);
      
      expect(id).toBeDefined();
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'user-1',
        action: 'CreateConnector',
      }));
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('UpdateConnectorHandler', () => {
    it('should update connector and generate audit log', async () => {
      const connector = Connector.create('conn-1', 'org-1', 'workspace-1', 'Old Broker', 'MT5');
      connector.commit();
      repository.findById.mockResolvedValue(connector);

      const handler = new UpdateConnectorHandler(repository, auditRepository, eventBus);
      const command = new UpdateConnectorCommand('conn-1', 'org-1', 'workspace-1', 'New Broker', 'user-1');

      await handler.execute(command);
      
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'user-1',
        action: 'UpdateConnector',
      }));
      expect(eventBus.publish).toHaveBeenCalledTimes(1); // update event
    });

    it('should throw NotFoundException if connector does not exist or tenant mismatch', async () => {
      repository.findById.mockResolvedValue(null);

      const handler = new UpdateConnectorHandler(repository, auditRepository, eventBus);
      const command = new UpdateConnectorCommand('conn-1', 'org-1', 'workspace-1', 'New Broker', 'user-1');

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });
  });

  describe('ArchiveConnectorHandler', () => {
    it('should archive connector and generate audit log', async () => {
      const connector = Connector.create('conn-1', 'org-1', 'workspace-1', 'Broker', 'MT5');
      connector.commit();
      repository.findById.mockResolvedValue(connector);

      const handler = new ArchiveConnectorHandler(repository, auditRepository, eventBus);
      const command = new ArchiveConnectorCommand('conn-1', 'org-1', 'workspace-1', 'user-1');

      await handler.execute(command);
      
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'user-1',
        action: 'ArchiveConnector',
      }));
    });
  });
});
