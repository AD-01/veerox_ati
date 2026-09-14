import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';
import { ReconcilePortfolioHandler } from '../reconcile-portfolio.handler';
import { ReconcilePortfolioCommand, ExecutionOriginType } from '../../commands/reconcile-portfolio.command';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';

describe('ReconcilePortfolioHandler (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let handler: ReconcilePortfolioHandler;
  let moduleRef: TestingModule;
  let dbUrl: string;

  beforeAll(async () => {
    // Start Postgres container if available
    try {
      container = await new PostgreSqlContainer('postgres:15').start();
      dbUrl = container.getConnectionUri();
    } catch (e) {
      console.warn('Docker not available, skipping real PostgreSQL Testcontainers integration.');
      dbUrl = 'postgresql://dummy:dummy@localhost:5432/dummy';
    }

    // Run migrations / push schema
    const schemaPath = path.resolve(__dirname, '../../../../../../../packages/database');
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: dbUrl },
      cwd: schemaPath,
      stdio: 'ignore'
    });

    moduleRef = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        ReconcilePortfolioHandler,
        {
          provide: PrismaService,
          useFactory: () => {
            const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
            return client as any; // Cast as PrismaService
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn().mockImplementation((obj) => obj),
          },
        }
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    await prisma.$connect();
    handler = moduleRef.get<ReconcilePortfolioHandler>(ReconcilePortfolioHandler);
  }, 30000); // 30 seconds for container start

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    // Clean up DB before each test
    await prisma.outboxMessage.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.portfolioReconciliationDiscrepancy.deleteMany();
    await prisma.portfolioReconciliationSnapshot.deleteMany();
    await prisma.portfolioTransaction.deleteMany();
    await prisma.executionFill.deleteMany();
    await prisma.executionOrder.deleteMany();
    await prisma.connectorCommand.deleteMany();
    await prisma.position.deleteMany();
    await prisma.tradingAccount.deleteMany();
  });

  it('Track G: should prevent duplicate reconciliation snapshots and only process 1 resolution for concurrent workers', async () => {
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
        status: 'AWAITING_RECONCILIATION', // Uncertain state
        connectorCommandId: 'cmd1',
      } as any
    });

    const externalSnapshotId = 'snap_123';
    const command = new ReconcilePortfolioCommand(
      'org1',
      'ws1',
      accountId,
      externalSnapshotId,
      new Date(),
      [
        {
          symbolId: 'sym1',
          side: 'BUY',
          quantity: 10,
          averageEntryPrice: 105.5,
          brokerTicketId: 'ticket1',
          clientExecutionId: orderId, // Match by exact clientExecutionId
          executedPrice: 105.5,
          realizedPnl: 0,
          commission: -5,
          swap: 0,
        }
      ],
      10000,
      10000,
      0,
      10000
    );

    // 2. Simulate concurrent workers processing the SAME snapshot
    const worker1 = handler.execute(command);
    const worker2 = handler.execute(command);
    const worker3 = handler.execute(command);

    await Promise.allSettled([worker1, worker2, worker3]);

    // 3. Assertions
    // Only 1 snapshot was created because of P2002 duplicate idempotencyKey handling
    const snapshots = await prisma.portfolioReconciliationSnapshot.findMany();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].status).toBe('COMPLETED');

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
