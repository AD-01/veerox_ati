import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma/client';
import { PolicyEvaluatedEvent } from '@veerox/events';
import { ResolvePolicyDecisionCommand } from '../commands/resolve-policy-decision.command';

@EventsHandler(PolicyEvaluatedEvent)
export class PolicyEvaluatedEventHandler implements IEventHandler<PolicyEvaluatedEvent> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: PolicyEvaluatedEvent): Promise<void> {
    // 1. Verify tenant authorization against authoritative state
    const decision = await this.prisma.decision.findUnique({
      where: { id: event.decisionId },
    });

    if (
      !decision ||
      decision.organizationId !== event.organizationId ||
      decision.workspaceId !== event.workspaceId
    ) {
      // Fail closed on cross-tenant or missing decision
      return;
    }

    // 2. Upsert the PolicyResolutionState (without overwriting expectedPolicyCount if it exists)
    await this.prisma.policyResolutionState.upsert({
      where: { correlationId: event.correlationId },
      create: {
        correlationId: event.correlationId,
        decisionId: event.decisionId,
        organizationId: event.organizationId,
        workspaceId: event.workspaceId,
        status: 'PENDING',
      },
      update: {}, // Just ensure it exists
    });

    // 3. Dispatch the resolution command
    await this.commandBus.execute(
      new ResolvePolicyDecisionCommand(
        event.correlationId,
        event.decisionId,
        event.organizationId,
        event.workspaceId,
      )
    );
  }
}
