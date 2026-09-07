import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { PolicyDecisionResolvedEvent } from '@veerox/events';
import { ProcessPolicyResolutionHandler } from './process-policy-resolution.handler';

describe('ProcessPolicyResolutionHandler', () => {
  let handler: ProcessPolicyResolutionHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let publisher: any;

  beforeEach(async () => {
    prisma = {
      decision: {
        findUnique: jest.fn(),
      },
      decisionCorrelation: {
        findUnique: jest.fn(),
      },
      executionOrder: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    publisher = {
      mergeObjectContext: jest.fn().mockImplementation((obj) => {
        obj.commit = jest.fn();
        obj.create = jest.fn();
        return obj;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessPolicyResolutionHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventPublisher, useValue: publisher },
        { provide: OutboxService, useValue: { saveEvents: jest.fn() } },
      ],
    }).compile();

    handler = module.get<ProcessPolicyResolutionHandler>(ProcessPolicyResolutionHandler);
  });

  it('should skip if policy outcome is REJECTED', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = new PolicyDecisionResolvedEvent(
      'res-1', 'cor-1', 'dec-1', 'org-1', 'ws-1', 'REJECTED', { limits: {}, prohibitions: [] }, [], [], new Date()
    );

    await handler.handle(event);
    expect(prisma.decision.findUnique).not.toHaveBeenCalled();
  });

  it('should create execution order if policy outcome is APPROVED', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = new PolicyDecisionResolvedEvent(
      'res-1', 'cor-1', 'dec-1', 'org-1', 'ws-1', 'APPROVED', { limits: {}, prohibitions: [] }, [], [], new Date()
    );

    prisma.decision.findUnique.mockResolvedValue({
      id: 'dec-1',
      accountId: 'acc-1',
      symbolId: 'sym-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    });

    prisma.decisionCorrelation.findUnique.mockResolvedValue({
      correlationId: 'cor-1',
      workspaceId: 'ws-1',
      opportunityPayload: JSON.stringify({
        orderType: 'MARKET',
        side: 'BUY',
        size: 2.0,
      }),
    });

    await handler.handle(event);

    expect(prisma.executionOrder.create).toHaveBeenCalled();
    const createCall = prisma.executionOrder.create.mock.calls[0][0];
    expect(createCall.data.orderType).toBe('MARKET');
    expect(createCall.data.side).toBe('BUY');
    expect(createCall.data.size).toBe(2.0);
    expect(createCall.data.status).toBe('PENDING');
  });
});
