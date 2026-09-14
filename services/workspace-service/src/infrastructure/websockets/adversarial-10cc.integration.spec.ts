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

describe('Phase 10-C-C Durable Execution Delivery (Integration)', () => {
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
    const wsId = uuidv4();
    const accountId = uuidv4();
    
    await prisma.organization.create({ data: { id: orgId, name: 'Org 1', slug: orgId, ownerUserId: 'system' } as any });
    await prisma.workspace.create({ data: { id: wsId, organizationId: orgId, name: 'WS 1' } });

    await prisma.tradingAccount.create({
      data: {
        id: accountId, organizationId: orgId, workspaceId: wsId, connectorId: 'conn-1',
        brokerName: 'B1', brokerServer: 'S1', accountNumber: '111', accountName: 'A1',
        accountType: 'LIVE', platform: 'MT5', terminalVersion: '1', leverage: '1:100',
        currency: 'USD', status: 'ACTIVE'
      }
    });

    return { orgId, wsId, accountId };
  };

  it('10-C-C: Gateway must send EXECUTION_REPORT_ACK on successful processing', async () => {
    const env = await setupEnv();
    const mockClient = { send: jest.fn() } as any;

    (gateway as any).connectedAgents.set('conn-1', {
      socket: mockClient,
      connectorId: 'conn-1',
      agentId: 'agent-1',
      tradingAccountId: env.accountId,
      organizationId: env.orgId,
      workspaceId: env.wsId,
      status: 'CONNECTED',
    });

    const order = await prisma.executionOrder.create({
      data: {
        id: uuidv4(),
        organizationId: env.orgId,
        workspaceId: env.wsId,
        accountId: env.accountId,
        symbolId: 'EURUSD',
        side: 'BUY',
        size: 10,
        status: 'PENDING',
        orderType: 'MARKET',
        remainingSize: 10
      } as any
    });

    const execReportId = uuidv4();
    const payload = {
      executionReportId: execReportId,
      action: 'ORDER_PLACED',
      clientExecutionId: order.id,
      brokerOrderId: 'broker-ord-123',
    };

    await gateway.handleExecutionReport(payload, mockClient);

    // Verify ACK was sent
    expect(mockClient.send).toHaveBeenCalledWith(
      expect.stringContaining(`"type":"EXECUTION_REPORT_ACK"`)
    );
    expect(mockClient.send).toHaveBeenCalledWith(
      expect.stringContaining(`"executionReportId":"${execReportId}"`)
    );
  });

  it('10-C-C: Gateway must STILL send ACK if execution report is a duplicate (P2002)', async () => {
    const env = await setupEnv();
    const mockClient = { send: jest.fn() } as any;

    (gateway as any).connectedAgents.set('conn-1', {
      socket: mockClient,
      connectorId: 'conn-1',
      agentId: 'agent-1',
      tradingAccountId: env.accountId,
      organizationId: env.orgId,
      workspaceId: env.wsId,
      status: 'CONNECTED',
    });

    const order = await prisma.executionOrder.create({
      data: {
        id: uuidv4(),
        organizationId: env.orgId,
        workspaceId: env.wsId,
        accountId: env.accountId,
        symbolId: 'EURUSD',
        side: 'BUY',
        size: 10,
        status: 'PENDING',
        orderType: 'MARKET',
        remainingSize: 10
      } as any
    });

    const execReportId = uuidv4();
    const payload = {
      executionReportId: execReportId,
      action: 'ORDER_FILLED',
      clientExecutionId: order.id,
      brokerOrderId: 'broker-ord-123',
      executedSize: 10,
    };

    // First delivery
    await gateway.handleExecutionReport(payload, mockClient);
    expect(mockClient.send).toHaveBeenCalledTimes(1);

    // Simulate agent failing to receive ACK and retrying
    await gateway.handleExecutionReport(payload, mockClient);
    
    // The second delivery will trigger a P2002 idempotency violation on outboxMessage
    // It should be safely swallowed, but the ACK must STILL be sent back!
    expect(mockClient.send).toHaveBeenCalledTimes(2); // Should have sent ACK again
    
    // Validate that the order is completely correct
    const finalOrder = await prisma.executionOrder.findUnique({ where: { id: order.id } });
    expect(finalOrder?.status).toBe('FILLED');
    expect(Number((finalOrder as any)?.executedSize)).toBe(10);
  });
});
