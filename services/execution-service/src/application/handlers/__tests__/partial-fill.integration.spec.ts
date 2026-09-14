import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService, PrismaClient } from '@veerox/database';
import { v4 as uuidv4 } from 'uuid';
import { OutboxService } from '@veerox/shared';
import { ProcessConnectorResponseHandler } from '../process-connector-response.handler';
import { ConnectorResponseReceivedEvent } from '@veerox/events';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';

describe('Partial Fill (Integration)', () => {
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
      execSync('npx prisma db push --skip-generate', {
        env: { ...process.env, DATABASE_URL: dbUrl },
        cwd: schemaPath,
        stdio: 'ignore'
      });
    } catch {
      // Fallback for mocked mode
      dbUrl = 'postgres://fake:fake@localhost:5432/fake';
    }

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        ProcessConnectorResponseHandler,
        {
          provide: PrismaService,
          useFactory: () => {
            const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
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
    handler = moduleRef.get<ProcessConnectorResponseHandler>(ProcessConnectorResponseHandler);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    try {
      await prisma.executionFill.deleteMany();
      await prisma.executionOrder.deleteMany();
      await prisma.connectorCommand.deleteMany();
      await prisma.tradingAccount.deleteMany();
    } catch {}
  });

  it('TRACK B: should process cumulative partial fills as pure deltas and ignore duplicates', async () => {
    if (!container) {
      console.warn('Skipping actual DB interaction, Docker missing');
      return;
    }
    const accountId = uuidv4();
    const commandId = uuidv4();
    const orderId = uuidv4();

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
        platform: 'MT5',
        terminalVersion: 'build 4000',
        leverage: '1:100',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    await prisma.executionOrder.create({
      data: {
        id: orderId,
        organizationId: 'org1',
        workspaceId: 'ws1',
        accountId: accountId,
        symbolId: 'EURUSD',
        decisionId: uuidv4(),
        orderType: 'MARKET',
        side: 'BUY',
        size: 10,
        remainingSize: 10,
        status: 'DISPATCHED',
      } as any,
    });

    await prisma.connectorCommand.create({
      data: {
        id: commandId,
        connectorId: 'conn1',
        commandType: 'TRADE_EXECUTE',
        status: 'DISPATCHED',
        payloadJson: JSON.stringify({ clientExecutionId: orderId })
      }
    });

    // Fill #1 (4)
    const fill1 = new ConnectorResponseReceivedEvent(
      uuidv4(),
      commandId,
      'conn1',
      'PARTIALLY_FILLED',
      'Partial fill',
      JSON.stringify({
        clientExecutionId: orderId,
        brokerOrderId: 'MT5_ORD_1',
        brokerTicketId: 'MT5_DEAL_1',
        executedSize: 4,
        executedPrice: 1.1000,
        commission: -0.5,
        swap: 0,
        realizedPnl: 0
      }),
      new Date()
    );
    await handler.handle(fill1);

    let order = await prisma.executionOrder.findUnique({ where: { id: orderId } });
    expect((order as any)!.remainingSize).toBe(6);
    expect((order as any)!.executedSize).toBe(4);
    expect(order!.status).toBe('PARTIALLY_FILLED');

    // Fill #2 (3) (Total executed from broker = 7)
    // Wait, MT5 reports CUMULATIVE or DELTA?
    // In our payload it reports cumulative? No, in VeeroxAgent.mq5, HistoryDealGetDouble(ticket, DEAL_VOLUME) is delta!
    // Wait, if it reports delta, then we just add it?
    // Let's check VeeroxAgent.mq5. It sends DEAL_VOLUME (which is the volume of the individual deal).
    // So the payload is a DELTA. Wait!
    // process-connector-response.handler.ts calculates executedSize by adding to order.executedSize? Let's check.
    const fill2 = new ConnectorResponseReceivedEvent(
      uuidv4(),
      commandId,
      'conn1',
      'PARTIALLY_FILLED',
      'Partial fill',
      JSON.stringify({
        clientExecutionId: orderId,
        brokerOrderId: 'MT5_ORD_1',
        brokerTicketId: 'MT5_DEAL_2',
        executedSize: 3,
        executedPrice: 1.1000,
      }),
      new Date()
    );

    await Promise.all([
      handler.handle(fill2),
      handler.handle(fill2),
      handler.handle(fill2) // duplicates!
    ]);

    order = await prisma.executionOrder.findUnique({ where: { id: orderId } });
    expect((order as any)!.remainingSize).toBe(3);
    expect((order as any)!.executedSize).toBe(7); // 4 + 3

    const fills = await prisma.executionFill.findMany({ where: { executionOrderId: orderId } });
    expect(fills.length).toBe(2); // exactly two unique deals

    // Fill #3 (3)
    const fill3 = new ConnectorResponseReceivedEvent(
      uuidv4(),
      commandId,
      'conn1',
      'FILLED',
      'Filled',
      JSON.stringify({
        clientExecutionId: orderId,
        brokerOrderId: 'MT5_ORD_1',
        brokerTicketId: 'MT5_DEAL_3',
        executedSize: 3,
        executedPrice: 1.1000,
      }),
      new Date()
    );
    await handler.handle(fill3);

    order = await prisma.executionOrder.findUnique({ where: { id: orderId } });
    expect((order as any)!.remainingSize).toBe(0);
    expect((order as any)!.executedSize).toBe(10); // 4 + 3 + 3
    expect(order!.status).toBe('FILLED');
  });
});
