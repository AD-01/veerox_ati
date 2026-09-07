import { ResolvePolicyDecisionCommandHandler } from './resolve-policy-decision.command-handler';
import { ResolvePolicyDecisionCommand } from '../commands/resolve-policy-decision.command';
import { PolicyResolutionService } from '../../domain/services/policy-resolution.service';
import { PolicyDecisionResolvedEvent } from '@veerox/events';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '@nestjs/cqrs';
import { IAuditRepository } from '../ports/audit.repository.interface';

describe('ResolvePolicyDecisionCommandHandler', () => {
  let handler: ResolvePolicyDecisionCommandHandler;
  let mockFindUniqueState: jest.Mock;
  let mockUpdateMany: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockCount: jest.Mock;
  let mockFindMany: jest.Mock;
  let mockPublish: jest.Mock;
  let mockLog: jest.Mock;
  let prisma: PrismaClient;
  let resolutionService: PolicyResolutionService;
  let eventPublisher: EventBus;
  let auditRepository: IAuditRepository;

  beforeEach(() => {
    mockFindUniqueState = jest.fn();
    mockUpdateMany = jest.fn();
    mockUpdate = jest.fn();
    mockCount = jest.fn();
    mockFindMany = jest.fn();
    mockPublish = jest.fn();
    mockLog = jest.fn();

    prisma = Object.assign(Object.create(PrismaClient.prototype), {
      policyResolutionState: {
        findUnique: mockFindUniqueState,
        updateMany: mockUpdateMany,
        update: mockUpdate,
      },
      policyEvaluation: {
        count: mockCount,
        findMany: mockFindMany,
      },
    });
    
    resolutionService = new PolicyResolutionService();
    jest.spyOn(resolutionService, 'resolve');

    eventPublisher = Object.assign(Object.create(EventBus.prototype), {
      publish: mockPublish,
    });
    
    auditRepository = {
      log: mockLog,
    } as Pick<IAuditRepository, 'log'> as IAuditRepository;

    handler = new ResolvePolicyDecisionCommandHandler(
      prisma,
      resolutionService,
      eventPublisher,
      auditRepository
    );
  });

  const command = new ResolvePolicyDecisionCommand('corr-1', 'dec-1', 'org-1', 'ws-1');

  it('should abort if state is not found', async () => {
    mockFindUniqueState.mockResolvedValue(null);
    await handler.execute(command);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('should abort if expectedPolicyCount is null (completion event not received yet)', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'PENDING', expectedPolicyCount: null });
    await handler.execute(command);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('should abort if already RESOLVED', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'RESOLVED', expectedPolicyCount: 1 });
    await handler.execute(command);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('should abort if evaluation count is less than expected (evaluation event before completion)', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'PENDING', expectedPolicyCount: 2 });
    mockCount.mockResolvedValue(1); // Only 1 arrived
    await handler.execute(command);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('should abort if concurrent execution already resolved (atomic update count === 0)', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'PENDING', expectedPolicyCount: 2 });
    mockCount.mockResolvedValue(2);
    
    // Simulate failing the atomic lock
    mockUpdateMany.mockResolvedValue({ count: 0 });
    
    await handler.execute(command);
    
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('should successfully resolve and emit PolicyDecisionResolvedEvent when conditions met', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'PENDING', expectedPolicyCount: 2 });
    mockCount.mockResolvedValue(2);
    mockUpdateMany.mockResolvedValue({ count: 1 }); // Atomic lock success
    
    mockFindMany.mockResolvedValue([
      { id: 'eval-1', outcome: 'ALLOW', violations: [], effectiveLimits: { limits: { max: 100 }, prohibitions: [] } },
      { id: 'eval-2', outcome: 'ALLOW', violations: [], effectiveLimits: { limits: { max: 50 }, prohibitions: [] } }
    ]);

    await handler.execute(command);

    expect(resolutionService.resolve).toHaveBeenCalledTimes(1);
    
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { correlationId: 'corr-1' },
      data: { finalOutcome: 'ALLOW' },
    });

    expect(mockLog).toHaveBeenCalledTimes(1);
    const auditLog = mockLog.mock.calls[0][0];
    expect(auditLog.targetEntityType).toBe('PolicyResolution');
    expect(auditLog.action).toBe('POLICY_RESOLVED');
    expect(auditLog.correlationId).toBe('corr-1');
    expect(JSON.parse(auditLog.newState).outcome).toBe('ALLOW');

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const event = mockPublish.mock.calls[0][0] as PolicyDecisionResolvedEvent;
    expect(event.correlationId).toBe('corr-1');
    expect(event.policyOutcome).toBe('ALLOW');
    expect(event.effectiveLimits.limits.max).toBe(50);
  });

  it('should resolve zero policies securely (expectedCount = 0)', async () => {
    mockFindUniqueState.mockResolvedValue({ status: 'PENDING', expectedPolicyCount: 0 });
    mockCount.mockResolvedValue(0);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindMany.mockResolvedValue([]);

    await handler.execute(command);

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const event = mockPublish.mock.calls[0][0] as PolicyDecisionResolvedEvent;
    expect(event.policyOutcome).toBe('ALLOW');
  });
});
