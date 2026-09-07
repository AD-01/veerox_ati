import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationService } from './correlation.service';
import { PrismaService } from '@veerox/database';
import { CommandBus } from '@nestjs/cqrs';
import { GenerateDecisionCommand } from '../commands/generate-decision.command';

describe('CorrelationService', () => {
  let service: CorrelationService;
  let commandBus: CommandBus;
  let mockDecisionCorrelation: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockDecisionCorrelation = {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationService,
        {
          provide: PrismaService,
          useValue: {
            decisionCorrelation: mockDecisionCorrelation,
          },
        },
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CorrelationService>(CorrelationService);
    commandBus = module.get<CommandBus>(CommandBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a pending correlation when opportunity arrives first', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ strategyId: 's1' }),
      riskPayload: null,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: { strategyId: 's1' },
    });

    expect(mockDecisionCorrelation.upsert).toHaveBeenCalledWith({
      where: { correlationId: '123' },
      update: expect.any(Object),
      create: expect.any(Object),
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should create a pending correlation when risk arrives first', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: null,
      opportunityPayload: null,
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      riskPayload: { riskScore: 50 },
    });

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should correlate and execute command when both events arrive', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ 
        correlationId: '123',
        workspaceId: 'ws1',
        organizationId: 'org1',
        strategyId: 's1',
        accountId: 'acc1',
        symbolId: 'sym1',
        direction: 'LONG',
        size: 100,
        stopLoss: 90,
        takeProfit: 110
      }),
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    mockDecisionCorrelation.updateMany.mockResolvedValue({ count: 1 });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      riskPayload: { riskScore: 50 },
    });

    expect(mockDecisionCorrelation.updateMany).toHaveBeenCalledWith({
      where: { correlationId: '123', status: 'PENDING' },
      data: { status: 'CONSUMED' },
    });
    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(GenerateDecisionCommand));
  });

  it('should ignore duplicate events (idempotency)', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ strategyId: 's1' }),
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'CONSUMED',
      expiresAt: new Date(Date.now() + 5000),
    });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      riskPayload: { riskScore: 50 },
    });

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should expire if ttl is reached', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ strategyId: 's1' }),
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    mockDecisionCorrelation.updateMany.mockResolvedValue({ count: 1 });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      riskPayload: { riskScore: 50 },
    });

    expect(mockDecisionCorrelation.updateMany).toHaveBeenCalledWith({
      where: { correlationId: '123', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should reject cross-tenant correlation attempt', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ strategyId: 's1' }),
      riskPayload: null,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws2', // Mismatched workspace
      riskPayload: { riskScore: 50 },
    });

    expect(mockDecisionCorrelation.updateMany).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('concurrent PENDING -> CONSUMED CAS race should dispatch only once', async () => {
    mockDecisionCorrelation.upsert.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ 
        correlationId: '123', workspaceId: 'ws1', organizationId: 'org1',
        strategyId: 's1', accountId: 'acc1', symbolId: 'sym1', direction: 'LONG', size: 100, stopLoss: 90, takeProfit: 110
      }),
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    // Simulate CAS behavior: first caller gets count: 1, second gets count: 0
    mockDecisionCorrelation.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    // Simulate concurrent processing
    await Promise.all([
      service.correlate({ correlationId: '123', workspaceId: 'ws1', riskPayload: { riskScore: 50 } }),
      service.correlate({ correlationId: '123', workspaceId: 'ws1', riskPayload: { riskScore: 50 } })
    ]);

    // Command should be executed exactly once
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('should recover from P2002 concurrent upsert race', async () => {
    // Upsert fails with P2002
    mockDecisionCorrelation.upsert.mockRejectedValue({ code: 'P2002' });
    
    // Recovery via update succeeds
    mockDecisionCorrelation.update.mockResolvedValue({
      correlationId: '123',
      workspaceId: 'ws1',
      organizationId: 'org1',
      opportunityPayload: JSON.stringify({ 
        correlationId: '123', workspaceId: 'ws1', organizationId: 'org1',
        strategyId: 's1', accountId: 'acc1', symbolId: 'sym1', direction: 'LONG', size: 100, stopLoss: 90, takeProfit: 110
      }),
      riskPayload: JSON.stringify({ riskScore: 50 }),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5000),
    });

    mockDecisionCorrelation.updateMany.mockResolvedValue({ count: 1 });

    await service.correlate({
      correlationId: '123',
      workspaceId: 'ws1',
      riskPayload: { riskScore: 50 },
    });

    expect(mockDecisionCorrelation.update).toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });
});
