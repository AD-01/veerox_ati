import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@veerox/database';
import { v4 as uuidv4 } from 'uuid';
import { OutboxService } from '@veerox/shared';
import { ProcessPolicyResolutionHandler } from '../process-policy-resolution.handler';
import { PolicyDecisionResolvedEvent } from '@veerox/events';

describe('Execution Concurrency (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let handler: ProcessPolicyResolutionHandler;
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
      imports: [],
      providers: [
        ProcessPolicyResolutionHandler,
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
    handler = moduleRef.get<ProcessPolicyResolutionHandler>(ProcessPolicyResolutionHandler);
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await prisma.outboxMessage.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.executionOrder.deleteMany();
    await prisma.tradingAccount.deleteMany();
    await prisma.decision.deleteMany();
  });

  it('TRACK A: should prevent duplicate execution order creation under concurrent worker dispatch', async () => {
    const accountId = uuidv4();
    const decisionId = uuidv4();

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

    await prisma.decision.create({
      data: {
        id: decisionId,
        organizationId: 'org1',
        workspaceId: 'ws1',
        accountId,
        symbolId: 'EURUSD',
        outcome: 'ALLOW',
        confidenceScore: 0.9,
        status: 'APPROVED',
        context: '{}',
        explanation: 'Test'
      }
    });

    const event = new PolicyDecisionResolvedEvent(
      uuidv4(), // resolutionId
      uuidv4(), // correlationId
      decisionId,
      'org1',
      'ws1',
      'ALLOW',
      {
        limits: {
          maxPositionSize: 10,
          maxDrawdownPercent: 10,
          maxLeverage: 100,
          maxDailyLoss: 1000,
          maxOpenPositions: 5,
          maxRiskPerTrade: 100
        },
        prohibitions: []
      },
      [],
      [],
      new Date()
    );

    // Concurrently dispatch the exact same event
    const workerA = handler.handle(event);
    const workerB = handler.handle(event);

    await Promise.all([workerA, workerB]);

    // Expect exactly ONE ExecutionOrder for this decision
    const orders = await prisma.executionOrder.findMany({
      where: { decisionId }
    });

    expect(orders.length).toBe(1);
    
    const logs = await prisma.auditLog.findMany({
      where: { targetEntityType: 'ExecutionOrder' }
    });
    // Exactly one creation audit log
    expect(logs.length).toBe(1);
  });
});
