/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorGateway } from './connector.gateway';
import { PrismaService } from '@veerox/database';
import { CommandBus } from '@nestjs/cqrs';
import * as crypto from 'crypto';

describe('ConnectorGateway', () => {
  let gateway: ConnectorGateway;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectorGateway,
        {
          provide: PrismaService,
          useValue: {
            connector: { findUnique: jest.fn() },
            connectorCredential: { update: jest.fn() },
            tradingAccount: { findUnique: jest.fn() },
            connectorCommand: { findMany: jest.fn() },
            auditLog: { create: jest.fn() },
          },
        },
        {
          provide: CommandBus,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<ConnectorGateway>(ConnectorGateway);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('Authentication (Track A & B)', () => {
    it('should reject invalid HMAC signature', async () => {
      // Set up mocks
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const agentId = 'agent-1';
      
      // We set a pending auth manually
      (gateway as any).pendingAuth.set(agentId, { nonce: 'testnonce', timestamp: 12345, connectorId: 'conn-1' });

      jest.spyOn(prisma.connector, 'findUnique').mockResolvedValue({
        id: 'conn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        credentials: [{ secretHash: 'aes:invalid' }],
      } as any);

      await gateway.handleAuthResponse(
        { agentId, signature: 'wrong_sig', tradingAccountId: 'acc-1' },
        mockClient,
      );

      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('AUTH_FAILED'));
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should authenticate with valid signature and trading account', async () => {
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const agentId = 'agent-1';
      const nonce = 'testnonce';
      const timestamp = 12345;
      
      (gateway as any).pendingAuth.set(agentId, { nonce, timestamp, connectorId: 'conn-1' });

      const ENCRYPTION_KEY = 'default_32_byte_secret_key_mock_12';
      const agentSecret = 'my-secret';
      
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
      let encrypted = cipher.update(agentSecret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      const secretHash = `aes:${iv.toString('hex')}:${encrypted}:${authTag}`;

      jest.spyOn(prisma.connector, 'findUnique').mockResolvedValue({
        id: 'conn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        credentials: [{ secretHash }],
      } as any);

      const expectedSignature = crypto
        .createHmac('sha256', agentSecret)
        .update(`${nonce}${timestamp}${agentId}`)
        .digest('hex');

      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue({
        id: 'acc-1',
        connectorId: 'conn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
      } as any);

      await gateway.handleAuthResponse(
        { agentId, signature: expectedSignature, tradingAccountId: 'acc-1' },
        mockClient,
      );

      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify({ type: 'AUTH_SUCCESS' }));
      expect((gateway as any).connectedAgents.has('conn-1')).toBeTruthy();
    });

    it('should reject wrong trading account workspace', async () => {
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const agentId = 'agent-1';
      const nonce = 'testnonce';
      const timestamp = 12345;
      
      (gateway as any).pendingAuth.set(agentId, { nonce, timestamp, connectorId: 'conn-1' });

      const ENCRYPTION_KEY = 'default_32_byte_secret_key_mock_12';
      const agentSecret = 'my-secret';
      
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
      let encrypted = cipher.update(agentSecret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      const secretHash = `aes:${iv.toString('hex')}:${encrypted}:${authTag}`;

      jest.spyOn(prisma.connector, 'findUnique').mockResolvedValue({
        id: 'conn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        credentials: [{ secretHash }],
      } as any);

      const expectedSignature = crypto
        .createHmac('sha256', agentSecret)
        .update(`${nonce}${timestamp}${agentId}`)
        .digest('hex');

      // Return trading account in a different workspace
      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue({
        id: 'acc-1',
        connectorId: 'conn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-wrong',
      } as any);

      await gateway.handleAuthResponse(
        { agentId, signature: expectedSignature, tradingAccountId: 'acc-1' },
        mockClient,
      );

      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('UNAUTHORIZED_ACCOUNT'));
    });
  });

  describe('Recovery Protocol (Track D, E, F)', () => {
    it('should replay missing commands in order and avoid duplicate recoveries', async () => {
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const agentId = 'agent-1';
      const connectorId = 'conn-1';

      (gateway as any).connectedAgents.set(connectorId, {
        socket: mockClient,
        connectorId,
        agentId,
        tradingAccountId: 'acc-1',
        status: 'CONNECTED',
      });

      const missingCommands = [
        { id: 'cmd-1', commandType: 'TRADE_EXECUTE', accountSequence: 4, payloadJson: '{"side": "BUY"}' },
        { id: 'cmd-2', commandType: 'CLOSE', accountSequence: 5, payloadJson: '{"brokerTicketId": "ticket-1"}' },
      ];

      jest.spyOn(prisma.connectorCommand, 'findMany').mockResolvedValue(missingCommands as any);

      // Concurrent recovery request protection simulation
      const req1 = gateway.handleRecoveryRequest({ lastSequence: 4 }, mockClient);
      const req2 = gateway.handleRecoveryRequest({ lastSequence: 4 }, mockClient);

      await Promise.all([req1, req2]);

      // Assert RECOVERY_STATE was sent once (due to lock)
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('RECOVERY_STATE'));
      
      // Assert commands were replayed in order
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('cmd-1'));
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('cmd-2'));
      
      // Assert RECOVERY_COMPLETE was sent
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('RECOVERY_COMPLETE'));
      
      // Only 1 execution because of duplicate protection
      // Verify sequence query logic (Blocker 1 & 2)
      expect(prisma.connectorCommand.findMany).toHaveBeenCalledWith({
        where: {
          connectorId,
          accountId: 'acc-1',
          accountSequence: { gt: 4 },
        },
        orderBy: { accountSequence: 'asc' },
      });
    });

    it('should replay zero commands if lastSequence is the latest', async () => {
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const connectorId = 'conn-1';

      (gateway as any).connectedAgents.set(connectorId, {
        socket: mockClient,
        connectorId,
        agentId: 'agent-1',
        tradingAccountId: 'acc-1',
        status: 'CONNECTED',
      });

      // No missing commands found
      jest.spyOn(prisma.connectorCommand, 'findMany').mockResolvedValue([] as any);

      await gateway.handleRecoveryRequest({ lastSequence: 10 }, mockClient);

      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('RECOVERY_STATE'));
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('RECOVERY_COMPLETE'));
      // Ensure no command was replayed
      expect(mockClient.send).not.toHaveBeenCalledWith(expect.stringContaining('RECOVERY_COMMAND'));
    });

    it('should reject recovery if explicitly requested accountId does not match bound account', async () => {
      const mockClient = { send: jest.fn(), close: jest.fn() } as any;
      const connectorId = 'conn-1';

      (gateway as any).connectedAgents.set(connectorId, {
        socket: mockClient,
        connectorId,
        agentId: 'agent-1',
        tradingAccountId: 'acc-1',
        status: 'CONNECTED',
      });

      await gateway.handleRecoveryRequest({ lastSequence: 5, accountId: 'acc-2' }, mockClient);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TRADING_ACCOUNT_AUTH_REJECTED',
            reason: expect.stringContaining('Mismatch between bound account'),
          }),
        }),
      );
      expect(mockClient.send).toHaveBeenCalledWith(expect.stringContaining('AUTH_FAILED'));
      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});
