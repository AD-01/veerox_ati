import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';
import { 
  ProvisionConnectorCredentialHandler,
  RotateConnectorCredentialHandler,
  RevokeConnectorCredentialHandler
} from './connector-credential.command-handlers';
import { 
  ProvisionConnectorCredentialCommand,
  RotateConnectorCredentialCommand,
  RevokeConnectorCredentialCommand
} from '../../commands/connector-credential.commands';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('Connector Credential Handlers', () => {
  let provisionHandler: ProvisionConnectorCredentialHandler;
  let rotateHandler: RotateConnectorCredentialHandler;
  let revokeHandler: RevokeConnectorCredentialHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaService: any;
  let auditRepository: Record<string, jest.Mock>;
  let eventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaService = {
      connector: {
        findUnique: jest.fn(),
      },
      connectorCredential: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaService)),
    };

    auditRepository = {
      log: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisionConnectorCredentialHandler,
        RotateConnectorCredentialHandler,
        RevokeConnectorCredentialHandler,
        { provide: PrismaService, useValue: prismaService },
        { provide: AUDIT_REPOSITORY, useValue: auditRepository },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    provisionHandler = module.get(ProvisionConnectorCredentialHandler);
    rotateHandler = module.get(RotateConnectorCredentialHandler);
    revokeHandler = module.get(RevokeConnectorCredentialHandler);
  });

  describe('ProvisionConnectorCredentialHandler', () => {
    it('should provision a credential if none exists', async () => {
      prismaService.connector.findUnique.mockResolvedValue({
        id: 'conn-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      });
      prismaService.connectorCredential.findFirst.mockResolvedValue(null);

      const command = new ProvisionConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      const result = await provisionHandler.execute(command);

      expect(result.secret).toBeDefined();
      expect(prismaService.connectorCredential.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should fail if connector not found', async () => {
      prismaService.connector.findUnique.mockResolvedValue(null);
      const command = new ProvisionConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      
      await expect(provisionHandler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should fail if cross tenant', async () => {
      prismaService.connector.findUnique.mockResolvedValue({
        id: 'conn-1',
        workspaceId: 'ws-2',
        organizationId: 'org-1',
      });
      const command = new ProvisionConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      
      await expect(provisionHandler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should fail if active credential already exists', async () => {
      prismaService.connector.findUnique.mockResolvedValue({
        id: 'conn-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      });
      prismaService.connectorCredential.findFirst.mockResolvedValue({ id: 'cred-1' });

      const command = new ProvisionConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      await expect(provisionHandler.execute(command)).rejects.toThrow(BadRequestException);
    });
  });

  describe('RotateConnectorCredentialHandler', () => {
    it('should rotate active credential', async () => {
      prismaService.connector.findUnique.mockResolvedValue({
        id: 'conn-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      });
      prismaService.connectorCredential.findMany.mockResolvedValue([{ id: 'old-cred-1' }]);

      const command = new RotateConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      const result = await rotateHandler.execute(command);

      expect(result.secret).toBeDefined();
      expect(prismaService.connectorCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ROTATED' }) })
      );
      expect(prismaService.connectorCredential.create).toHaveBeenCalled();
    });
  });

  describe('RevokeConnectorCredentialHandler', () => {
    it('should revoke active credential', async () => {
      prismaService.connector.findUnique.mockResolvedValue({
        id: 'conn-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      });
      prismaService.connectorCredential.findMany.mockResolvedValue([{ id: 'old-cred-1' }]);

      const command = new RevokeConnectorCredentialCommand('conn-1', 'org-1', 'ws-1', 'actor-1');
      await revokeHandler.execute(command);

      expect(prismaService.connectorCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REVOKED' }) })
      );
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });
});
