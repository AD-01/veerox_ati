import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma/client';
import { ResolvePolicyDecisionCommand } from '../commands/resolve-policy-decision.command';
import { PolicyResolutionService, PolicyEvaluationResult, EventPolicyViolation, EventEffectiveLimits } from '../../domain/services/policy-resolution.service';
import { PolicyDecisionResolvedEvent } from '@veerox/events';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@CommandHandler(ResolvePolicyDecisionCommand)
export class ResolvePolicyDecisionCommandHandler implements ICommandHandler<ResolvePolicyDecisionCommand> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly resolutionService: PolicyResolutionService,
    private readonly eventPublisher: EventBus,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
  ) {}

  async execute(command: ResolvePolicyDecisionCommand): Promise<void> {
    const { correlationId, decisionId, organizationId, workspaceId } = command;

    // 1. Fetch current resolution state
    const state = await this.prisma.policyResolutionState.findUnique({
      where: { correlationId },
    });

    if (!state) return;
    if (state.status !== 'PENDING') return;
    if (state.expectedPolicyCount === null) return;

    // 2. Count current evaluations
    const evaluationCount = await this.prisma.policyEvaluation.count({
      where: { correlationId },
    });

    // 3. Check for completion
    if (evaluationCount < state.expectedPolicyCount) {
      return; // Not complete yet
    }

    // 4. Atomic Lock: Attempt to transition status from PENDING to RESOLVED
    const updateResult = await this.prisma.policyResolutionState.updateMany({
      where: {
        correlationId,
        status: 'PENDING',
      },
      data: {
        status: 'RESOLVED',
      },
    });

    if (updateResult.count === 0) {
      // Concurrent execution already resolved it. Safely abort.
      return;
    }

    // 5. We now own the resolution. Fetch all evaluations.
    const evaluations = await this.prisma.policyEvaluation.findMany({
      where: { correlationId },
    });

    // Map to domain input
    const evaluationResults: PolicyEvaluationResult[] = evaluations.map(e => ({
      outcome: e.outcome,
      violations: (e.violations as unknown) as EventPolicyViolation[],
      effectiveLimits: (e.effectiveLimits as unknown) as EventEffectiveLimits,
    }));

    // 6. Execute core resolution domain logic
    const finalResult = this.resolutionService.resolve(evaluationResults);

    // 7. Update the state with final outcome
    await this.prisma.policyResolutionState.update({
      where: { correlationId },
      data: { finalOutcome: finalResult.outcome },
    });

    const resolutionId = uuidv4();

    // 8. Audit Log
    await this.auditRepository.log({
      actorId: 'system-ati',
      organizationId,
      workspaceId,
      targetEntityId: correlationId, // Tracking the resolution by correlationId
      targetEntityType: 'PolicyResolution',
      action: 'POLICY_RESOLVED',
      previousState: JSON.stringify({ status: 'PENDING' }),
      newState: JSON.stringify({
        status: 'RESOLVED',
        outcome: finalResult.outcome,
        violations: finalResult.violations,
      }),
      correlationId,
    });

    // 9. Emit Final Decision Event
    this.eventPublisher.publish(
      new PolicyDecisionResolvedEvent(
        resolutionId,
        correlationId,
        decisionId,
        organizationId,
        workspaceId,
        finalResult.outcome,
        finalResult.effectiveLimits,
        finalResult.violations,
        evaluations.map(e => e.id),
        new Date(),
      )
    );
  }
}
