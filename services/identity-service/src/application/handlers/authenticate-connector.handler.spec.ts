import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { TokenService } from '../../infrastructure/auth/token.service';
import { AuthenticateConnectorHandler } from './authenticate-connector.handler';
import { AuthenticateConnectorCommand } from '../commands/authenticate-connector.command';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthenticateConnectorHandler', () => {
  let handler: AuthenticateConnectorHandler;
  let prismaService: Record<string, Record<string, jest.Mock>>;
  let auditRepository: Record<string, jest.Mock>;
  let tokenService: Record<string, jest.Mock>;
  let eventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaService = {
      connector: {
        findUnique: jest.fn(),
      },
      connectorCredential: {
        update: jest.fn(),
      },
    };

    auditRepository = {
      log: jest.fn(),
    };

    tokenService = {
      generateMachineToken: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticateConnectorHandler,
        { provide: PrismaService, useValue: prismaService },
        { provide: AUDIT_REPOSITORY, useValue: auditRepository },
        { provide: TokenService, useValue: tokenService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    handler = module.get(AuthenticateConnectorHandler);
  });

  it('should authenticate valid connector', async () => {
    const mockConnector = {
      id: 'conn-1',
      status: 'ACTIVE',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      credentials: [{ id: 'cred-1', secretHash: 'hashed-secret' }],
    };
    prismaService.connector.findUnique.mockResolvedValue(mockConnector);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    tokenService.generateMachineToken.mockResolvedValue({ accessToken: 'token', expiresIn: 900 });

    const command = new AuthenticateConnectorCommand('conn-1', 'secret', '127.0.0.1');
    const result = await handler.execute(command);

    expect(result.accessToken).toBe('token');
    expect(prismaService.connectorCredential.update).toHaveBeenCalled();
    expect(tokenService.generateMachineToken).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'connector', sub: 'connector_conn-1' })
    );
  });

  it('should reject inactive connector', async () => {
    prismaService.connector.findUnique.mockResolvedValue({
      id: 'conn-1',
      status: 'ARCHIVED',
    });

    const command = new AuthenticateConnectorCommand('conn-1', 'secret', '127.0.0.1');
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ConnectorAuthenticationFailed' }));
  });

  it('should reject invalid secret', async () => {
    const mockConnector = {
      id: 'conn-1',
      status: 'ACTIVE',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      credentials: [{ id: 'cred-1', secretHash: 'hashed-secret' }],
    };
    prismaService.connector.findUnique.mockResolvedValue(mockConnector);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const command = new AuthenticateConnectorCommand('conn-1', 'wrong-secret', '127.0.0.1');
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject connector with no credentials', async () => {
    const mockConnector = {
      id: 'conn-1',
      status: 'ACTIVE',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      credentials: [],
    };
    prismaService.connector.findUnique.mockResolvedValue(mockConnector);

    const command = new AuthenticateConnectorCommand('conn-1', 'secret', '127.0.0.1');
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
  });
});
