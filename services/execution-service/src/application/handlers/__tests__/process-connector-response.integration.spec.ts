import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';
import { ProcessConnectorResponseHandler } from '../process-connector-response.handler';
import { ConnectorResponseReceivedEvent } from '@veerox/events';
import { PrismaClient } from '@veerox/database';
import { v4 as uuidv4 } from 'uuid';
import { OutboxService } from '@veerox/shared';

describe('ProcessConnectorResponseHandler (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let handler: ProcessConnectorResponseHandler;
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
      console.warn('Could not start PostgreSqlContainer. Docker may be missing.');
    }

    moduleRef = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        ProcessConnectorResponseHandler,
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
          useValue: {
            saveEvents: jest.fn(),
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn().mockImplementation((obj) => {
              obj.commit = jest.fn();
              obj.apply = jest.fn();
              return obj;
            }),
          },
        }
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    if (container) {
      await prisma.$connect();
    }
    handler = moduleRef.get<ProcessConnectorResponseHandler>(ProcessConnectorResponseHandler);
  }, 30000); // 30 seconds for container start

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    // Clean up DB before each test
    await prisma.outboxMessage.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.executionFill.deleteMany();
    await prisma.executionOrder.deleteMany();
    await prisma.connectorCommand.deleteMany();
    await prisma.tradingAccount.deleteMany();
  });

  it('Track G: should process duplicate concurrent execution fills and ensure exactly 1 execution fill and mutation occurs (P2002 prevention)', async () => {
    // 1. Setup Data
    const accountId = uuidv4();
    await prisma.tradingAccount.create({
      data: {
        id: accountId,
        organizationId: 'org1',
        workspaceId: 'ws1',
        connectorId: 'conn1',
        brokerName: 'TestBroker',
        brokerServer: 'TestServer',
        accountNumber: '12345',
        accountName: 'Test Account',
        accountType: 'LIVE',
        leverage: '1:100',
        currency: 'USD',
        platform: 'MT5',
        terminalVersion: '1000',
        synchronizationStatus: 'PENDING',
        status: 'ACTIVE',
        balance: 10000,
        equity: 10000,
        realizedPnl: 0,
        unrealizedPnl: 0,
        marginUsed: 0,
        freeMargin: 10000,
        nextCommandSequence: 1,
        version: 1,
        executionHalted: false,
      }
    });

    const commandId = uuidv4();
    await prisma.connectorCommand.create({
      data: {
        id: commandId,
        connectorId: 'conn1',
        accountId: accountId,
        accountSequence: 1,
        clientExecutionId: 'exec1',
        commandType: 'TRADE_EXECUTE',
        payloadJson: '{}',
        status: 'PENDING',
      } as any
    });

    const orderId = uuidv4();
    await prisma.executionOrder.create({
      data: {
        id: orderId,
        accountId: accountId,
        organizationId: 'org1',
        workspaceId: 'ws1',
        symbolId: 'sym1',
        orderType: 'MARKET',
        side: 'BUY',
        size: 10,
        executedSize: 0,
        remainingSize: 10,
        status: 'DISPATCHED',
        connectorCommandId: commandId,
      } as any
    });

    // We send two identical successful broker responses concurrently
    // Same responseId, meaning it's a duplicate ACK from the broker for the exact same fill
    const event = new ConnectorResponseReceivedEvent(
      'response_123',
      commandId,
      'conn1',
      'SUCCESS',
      'Filled',
      JSON.stringify({ executedPrice: 105.5, brokerTicketId: 'ticket1' }),
      new Date()
    );

    // 2. Simulate concurrent workers processing the SAME broker response
    const worker1 = handler.handle(event);
    const worker2 = handler.handle(event);
    const worker3 = handler.handle(event);

    await Promise.allSettled([worker1, worker2, worker3]);

    // 3. Assertions
    // ExecutionOrder should be FILLED exactly once
    const orders = await prisma.executionOrder.findMany({ where: { id: orderId } });
    expect(orders[0].status).toBe('FILLED');
    expect(orders[0].executedPrice?.toNumber()).toBe(105.5);

    // ExecutionFill should only have 1 record due to P2002 on create inside atomic update
    const fills = await prisma.executionFill.findMany({ where: { executionOrderId: orderId } });
    expect(fills.length).toBe(1);
    expect(fills[0].executedPrice?.toNumber()).toBe(105.5);

    // Only 1 execution filled audit log
    const auditLogs = await prisma.auditLog.findMany({ where: { action: 'EXECUTION_ORDER_FILLED' } });
    expect(auditLogs.length).toBe(1);
  });
});
