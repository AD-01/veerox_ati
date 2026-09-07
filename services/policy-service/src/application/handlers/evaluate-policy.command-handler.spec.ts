/* eslint-disable @typescript-eslint/no-explicit-any */
import { EvaluatePolicyCommandHandler } from './evaluate-policy.command-handler';
import { EvaluatePolicyCommand } from '../commands/evaluate-policy.command';
import { PolicyEvaluatedEvent, PolicyEvaluationCompletedEvent } from '@veerox/events';
import { Prisma } from '@prisma/client';
import { v5 as uuidv5, validate as uuidValidate } from 'uuid';

describe('EvaluatePolicyCommandHandler', () => {
  let handler: EvaluatePolicyCommandHandler;
  let prisma: any;
  let policyRepository: any;
  let evaluationRepository: any;
  let engine: any;
  let eventPublisher: any;
  let auditRepository: any;

  beforeEach(() => {
    prisma = {
      decision: {
        findUnique: jest.fn(),
      },
    };
    policyRepository = {
      findActivePolicies: jest.fn(),
    };
    evaluationRepository = {
      save: jest.fn(),
    };
    engine = {
      evaluate: jest.fn(),
    };
    eventPublisher = {
      publish: jest.fn(),
    };
    auditRepository = {
      log: jest.fn(),
    };

    handler = new EvaluatePolicyCommandHandler(
      prisma,
      policyRepository,
      evaluationRepository,
      engine,
      eventPublisher,
      auditRepository,
    );
  });

  const baseCommand = new EvaluatePolicyCommand(
    'decision-1',
    'corr-1',
    'workspace-1',
    'org-1'
  );

  const mockDecision = {
    id: 'decision-1',
    organizationId: 'org-1',
    workspaceId: 'workspace-1',
    context: JSON.stringify({ command: { tradeDirection: 'LONG', requestedSize: 100 } }),
  };

  describe('Policy Evaluation Tests', () => {
    it('should evaluate each policy independently and emit an event per policy + completion signal', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      policyRepository.findActivePolicies.mockResolvedValue([{ id: 'policy-1', version: 1 }]);
      
      engine.evaluate.mockReturnValue({
        outcome: 'ALLOW',
        evaluatedRules: ['rule-1'],
        violations: [],
        effectiveLimits: { toJSON: () => ({ limits: {}, prohibitions: [] }) },
        explanation: {},
      });

      await handler.execute(baseCommand);

      // Verify UUID validity
      const saveCall = evaluationRepository.save.mock.calls[0][0];
      expect(uuidValidate(saveCall.id)).toBe(true);
      expect(saveCall.correlationId).toBe('corr-1');
      expect(saveCall.policyId).toBe('policy-1');

      // Verify determinism
      const expectedEvaluationId = uuidv5('corr-1_policy-1', '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      expect(saveCall.id).toBe(expectedEvaluationId);

      expect(eventPublisher.publish).toHaveBeenCalledTimes(2);
      const evalEvent = eventPublisher.publish.mock.calls[0][0] as PolicyEvaluatedEvent;
      const completedEvent = eventPublisher.publish.mock.calls[1][0] as PolicyEvaluationCompletedEvent;
      
      expect(evalEvent.policyId).toBe('policy-1');
      expect(evalEvent.outcome).toBe('ALLOW');
      
      expect(completedEvent.expectedPolicyCount).toBe(1);
      expect(completedEvent.evaluatedPolicyIds).toEqual(['policy-1']);
    });

    it('should emit only PolicyEvaluationCompletedEvent with 0 count when zero active policies exist', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      policyRepository.findActivePolicies.mockResolvedValue([]); // Empty policies

      await handler.execute(baseCommand);

      expect(evaluationRepository.save).not.toHaveBeenCalled();
      expect(auditRepository.log).not.toHaveBeenCalled();
      
      expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
      const completedEvent = eventPublisher.publish.mock.calls[0][0] as PolicyEvaluationCompletedEvent;
      expect(completedEvent.expectedPolicyCount).toBe(0);
      expect(completedEvent.evaluatedPolicyIds).toEqual([]);
    });

    it('should throw error for fail-closed scenarios (missing decision)', async () => {
      prisma.decision.findUnique.mockResolvedValue(null); // Missing decision -> fail closed

      await expect(handler.execute(baseCommand)).rejects.toThrow('Decision not found or tenant mismatch');

      expect(evaluationRepository.save).not.toHaveBeenCalled();
      expect(auditRepository.log).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('Concurrency & Idempotency Tests', () => {
    it('should recover from P2002 duplicate request errors and still emit completion event', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      policyRepository.findActivePolicies.mockResolvedValue([{ id: 'policy-1', version: 1 }]);
      
      engine.evaluate.mockReturnValue({
        outcome: 'ALLOW',
        evaluatedRules: ['rule-1'],
        violations: [],
        effectiveLimits: { toJSON: () => ({ limits: {}, prohibitions: [] }) },
        explanation: {},
      });

      // Simulate concurrent duplicate triggering P2002
      evaluationRepository.save.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.x' })
      );

      // Should not throw!
      await expect(handler.execute(baseCommand)).resolves.not.toThrow();

      // Ensure the individual evaluation event is NOT published, but completion IS published
      expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
      const completedEvent = eventPublisher.publish.mock.calls[0][0] as PolicyEvaluationCompletedEvent;
      expect(completedEvent.expectedPolicyCount).toBe(1);
    });
  });

  describe('Audit Tests', () => {
    it('should create an audit record containing correct entity details and tenant context', async () => {
      prisma.decision.findUnique.mockResolvedValue(mockDecision);
      policyRepository.findActivePolicies.mockResolvedValue([{ id: 'policy-1', version: 1 }]);
      
      engine.evaluate.mockReturnValue({
        outcome: 'REJECT',
        evaluatedRules: ['rule-1'],
        violations: [{ toJSON: () => ({ reason: 'Test Violation' }) }],
        effectiveLimits: { toJSON: () => ({ limits: {}, prohibitions: [] }) },
        explanation: {},
      });

      await handler.execute(baseCommand);

      expect(auditRepository.log).toHaveBeenCalledTimes(1);
      const auditLog = auditRepository.log.mock.calls[0][0];

      expect(auditLog.actorId).toBe('system-ati');
      expect(auditLog.organizationId).toBe('org-1');
      expect(auditLog.workspaceId).toBe('workspace-1');
      expect(auditLog.targetEntityType).toBe('PolicyEvaluation');
      expect(auditLog.action).toBe('POLICY_EVALUATED');
      expect(auditLog.previousState).toBeNull();
      expect(auditLog.correlationId).toBe('corr-1');
      
      const newState = JSON.parse(auditLog.newState);
      expect(newState.outcome).toBe('REJECT');
      expect(newState.violations.length).toBe(1);
    });
  });
});
