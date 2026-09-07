import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PrismaClient, Prisma } from '@prisma/client';
import { EvaluatePolicyCommand } from '../commands/evaluate-policy.command';
import { IPolicyRepository } from '../../domain/interfaces/policy.repository.interface';
import { IPolicyEvaluationRepository } from '../../domain/interfaces/policy-evaluation.repository.interface';
import { PolicyEngineService, PolicyEvaluationContext } from '../../domain/services/policy-engine.service';
import { PolicyEvaluatedEvent, PolicyEvaluationCompletedEvent } from '@veerox/events';
import { IAuditRepository, AUDIT_REPOSITORY } from '../../application/ports/audit.repository.interface';
import { Inject } from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';

const POLICY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

@CommandHandler(EvaluatePolicyCommand)
export class EvaluatePolicyCommandHandler implements ICommandHandler<EvaluatePolicyCommand> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policyRepository: IPolicyRepository,
    private readonly evaluationRepository: IPolicyEvaluationRepository,
    private readonly engine: PolicyEngineService,
    private readonly eventPublisher: EventBus,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
  ) {}

  async execute(command: EvaluatePolicyCommand): Promise<void> {
    // 1. Load Decision
    const decision = await this.prisma.decision.findUnique({
      where: { id: command.decisionId },
    });

    if (!decision || decision.organizationId !== command.organizationId || decision.workspaceId !== command.workspaceId) {
      throw new Error('Decision not found or tenant mismatch');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contextData: any;
    try {
      contextData = JSON.parse(decision.context);
    } catch {
      throw new Error('Invalid decision context');
    }

    const tradeDirection = contextData?.command?.tradeDirection;
    const requestedSize = contextData?.command?.requestedSize;

    if (!tradeDirection || requestedSize === undefined) {
      throw new Error('Missing trade direction or requested size in context');
    }

    const evaluationContext: PolicyEvaluationContext = {
      organizationId: decision.organizationId,
      workspaceId: decision.workspaceId,
      accountId: decision.accountId,
      strategyId: decision.strategyId,
      symbolId: decision.symbolId,
      tradeDirection: tradeDirection as 'LONG' | 'SHORT',
      requestedSize: Number(requestedSize),
    };

    // 3. Load Active Policies
    const activePolicies = await this.policyRepository.findActivePolicies(command.organizationId, command.workspaceId);

    if (activePolicies.length === 0) {
      // Explicit no-policy state. Emit completion signal with 0 count.
      this.eventPublisher.publish(
        new PolicyEvaluationCompletedEvent(
          command.decisionId,
          command.correlationId,
          command.organizationId,
          command.workspaceId,
          0,
          [],
          new Date(),
        )
      );
      return;
    }

    // 4. Evaluate each policy independently and emit individual events
    for (const policy of activePolicies) {
      const result = this.engine.evaluate(policy, evaluationContext);
      
      // Generate deterministic evaluation ID using UUIDv5
      const evaluationId = uuidv5(`${command.correlationId}_${policy.id}`, POLICY_NAMESPACE);

      const evaluationData = {
        id: evaluationId,
        decisionId: command.decisionId,
        policyId: policy.id,
        correlationId: command.correlationId,
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        outcome: result.outcome,
        policyVersion: policy.version,
        violations: result.violations.map(v => v.toJSON()),
        effectiveLimits: result.effectiveLimits.toJSON(),
        explanation: result.explanation,
        createdAt: new Date(),
      };

      try {
        await this.evaluationRepository.save(evaluationData);

        // Audit Log for the creation
        await this.auditRepository.log({
          actorId: 'system-ati',
          organizationId: command.organizationId,
          workspaceId: command.workspaceId,
          targetEntityId: evaluationId,
          targetEntityType: 'PolicyEvaluation',
          action: 'POLICY_EVALUATED',
          previousState: null,
          newState: JSON.stringify({
            outcome: result.outcome,
            violations: evaluationData.violations,
          }),
          correlationId: command.correlationId,
        });

        // Publish individual policy evaluation event
        const event = new PolicyEvaluatedEvent(
          evaluationId,
          policy.id,
          policy.version,
          command.decisionId,
          command.correlationId,
          command.organizationId,
          command.workspaceId,
          result.outcome,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.effectiveLimits.toJSON() as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.violations.map(v => v.toJSON()) as any,
          result.evaluatedRules,
          result.explanation,
          new Date(),
        );

        this.eventPublisher.publish(event);

      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // P2002: Unique constraint failed
          // Idempotent recovery: skip saving AND skip event publishing,
          // as it was already handled by the concurrent successful execution
          continue;
        }
        throw error;
      }
    }

    // After evaluating all policies successfully (or bypassing via P2002 idempotency),
    // emit the authoritative completion signal for P04-C.
    this.eventPublisher.publish(
      new PolicyEvaluationCompletedEvent(
        command.decisionId,
        command.correlationId,
        command.organizationId,
        command.workspaceId,
        activePolicies.length,
        activePolicies.map(p => p.id),
        new Date(),
      )
    );
  }
}
