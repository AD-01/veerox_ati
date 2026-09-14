import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorGateway } from './connector.gateway';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { CommandBus } from '@nestjs/cqrs';
import { PrismaClient } from '@veerox/database';
// @ts-ignore
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 10-C-B Adversarial Financial Safety (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let gateway: ConnectorGateway;
  let moduleRef: TestingModule;
  let dbUrl: string;

  beforeAll(async () => {
    try {
      container = await new PostgreSqlContainer('postgres:15').start();
      dbUrl = container.getConnectionUri();

      const schemaPath = path.resolve(__dirname, '../../../../../../../packages/database');
      execSync(`npx prisma db push --schema=${schemaPath}/prisma/schema.prisma`, {
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
    } catch {
      console.warn('Could not start PostgreSqlContainer.');
    }

    moduleRef = await Test.createTestingModule({
      providers: [
        ConnectorGateway,
        {
          provide: PrismaService,
          useFactory: () => {
            const url = dbUrl || 'postgresql://dummy:dummy@localhost:5432/dummy';
            const client = new PrismaClient({ datasources: { db: { url } } });
            return client as unknown as PrismaService;
          },
        },
        {
          provide: OutboxService,
          useValue: { saveEvents: jest.fn() },
        },
        {
          provide: CommandBus,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    if (container) await prisma.$connect();
    gateway = moduleRef.get<ConnectorGateway>(ConnectorGateway);
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await prisma.outboxMessage.deleteMany();
    await prisma.executionOrder.deleteMany();
    await prisma.tradingAccount.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.organization.deleteMany();
  });

  const setupEnv = async () => {
    const orgId = uuidv4();
    const wsId1 = uuidv4();
    const wsId2 = uuidv4();
    const account1 = uuidv4();
    const account2 = uuidv4();
    
    await prisma.organization.create({ data: { id: orgId, name: 'Org 1', slug: orgId, ownerUserId: 'system' } as any });
    await prisma.workspace.create({ data: { id: wsId1, organizationId: orgId, name: 'WS 1' } });
    await prisma.workspace.create({ data: { id: wsId2, organizationId: orgId, name: 'WS 2' } });

    await prisma.tradingAccount.create({
      data: {
        id: account1, organizationId: orgId, workspaceId: wsId1, connectorId: 'conn-1',
        brokerName: 'B1', brokerServer: 'S1', accountNumber: '111', accountName: 'A1',
        accountType: 'LIVE', platform: 'MT5', terminalVersion: '1', leverage: '1:100',
        currency: 'USD', status: 'ACTIVE'
      }
    });

    await prisma.tradingAccount.create({
      data: {
        id: account2, organizationId: orgId, workspaceId: wsId2, connectorId: 'conn-2',
        brokerName: 'B1', brokerServer: 'S1', accountNumber: '222', accountName: 'A2',
        accountType: 'LIVE', platform: 'MT5', terminalVersion: '1', leverage: '1:100',
        currency: 'USD', status: 'ACTIVE'
      }
    });

    return { orgId, wsId1, wsId2, account1, account2 };
  };

  it('10-C-B: Cross-Tenant Execution Report Isolation', async () => {
    const env = await setupEnv();
    const mockClient = { send: jest.fn() } as any;

    // Simulate Agent 2 (Malicious or broken) authenticating
    (gateway as any).connectedAgents.set('conn-2', {
      socket: mockClient,
      connectorId: 'conn-2',
      agentId: 'agent-2',
      tradingAccountId: env.account2, // Agent 2 belongs to Account 2
      organizationId: env.orgId,
      workspaceId: env.wsId2,
      status: 'CONNECTED',
    });

    // Create a legitimate order in Workspace 1 (Account 1)
    const victimOrder = await prisma.executionOrder.create({
      data: {
        id: uuidv4(),
        organizationId: env.orgId,
        workspaceId: env.wsId1,
        accountId: env.account1,
        symbolId: 'EURUSD',
        side: 'BUY',
        size: 10,
        status: 'PENDING',
        orderType: 'MARKET',
        remainingSize: 10
      } as any
    });

    // Agent 2 attempts to send an EXECUTION_REPORT targeting Victim Order
    const payload = {
      executionReportId: uuidv4(),
      action: 'ORDER_FILLED',
      clientExecutionId: victimOrder.id, // Targeting victim order directly
      brokerOrderId: 'hacked-123',
      executedSize: 10,
      executedPrice: 1.1000,
    };

    await gateway.handleExecutionReport(payload, mockClient);

    // Victim order should NOT be modified because Agent 2's workspace context (wsId2) does not match victimOrder (wsId1)
    const orderAfter = await prisma.executionOrder.findUnique({ where: { id: victimOrder.id } });
    expect(orderAfter?.status).toBe('PENDING'); // No change
    expect((orderAfter as any)?.brokerOrderId).toBeNull();
  });

  it('10-C-B: Protect Executed Size from Late Events (Ratchet)', async () => {
    const env = await setupEnv();
    const mockClient = { send: jest.fn() } as any;

    (gateway as any).connectedAgents.set('conn-1', {
      socket: mockClient,
      connectorId: 'conn-1',
      agentId: 'agent-1',
      tradingAccountId: env.account1,
      organizationId: env.orgId,
      workspaceId: env.wsId1,
      status: 'CONNECTED',
    });

    const order = await prisma.executionOrder.create({
      data: {
        id: uuidv4(),
        organizationId: env.orgId,
        workspaceId: env.wsId1,
        accountId: env.account1,
        symbolId: 'EURUSD',
        side: 'BUY',
        size: 10,
        executedSize: 8,
        status: 'PARTIALLY_FILLED',
        orderType: 'MARKET',
        remainingSize: 2
      } as any
    });

    // Malicious or late event attempting to SHRINK the executed size
    const payload = {
      action: 'ORDER_FILLED', // Maybe a stale message
      clientExecutionId: order.id,
      executedSize: 5, // Less than current 8
      executedPrice: 1.1000,
    };

    await gateway.handleExecutionReport(payload, mockClient);

    const orderAfter = await prisma.executionOrder.findUnique({ where: { id: order.id } });
    expect(Number((orderAfter as any)?.executedSize)).toBe(8); // Ratchet protected the size!
    expect(orderAfter?.status).toBe('FILLED'); // Status was still updated forward
  });
});
