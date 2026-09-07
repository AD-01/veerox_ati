import { EventsHandler, IEventHandler, EventPublisher } from '@nestjs/cqrs';
import { PolicyDecisionResolvedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { ExecutionOrder } from '../../domain/aggregates/execution-order.aggregate';
import { v5 as uuidv5 } from 'uuid';

const EXECUTION_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

@EventsHandler(PolicyDecisionResolvedEvent)
export class ProcessPolicyResolutionHandler implements IEventHandler<PolicyDecisionResolvedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async handle(event: PolicyDecisionResolvedEvent) {
    if (event.policyOutcome !== 'ALLOW' && event.policyOutcome !== 'APPROVED') {
      console.log(`Decision ${event.decisionId} was not approved. Skipping execution.`);
      return;
    }

    const decision = await this.prisma.decision.findUnique({
      where: { id: event.decisionId },
      include: {
        workspace: {
          include: { DecisionCorrelation: { where: { correlationId: event.correlationId } } },
        },
      },
    });

    if (!decision) {
      throw new Error(`Decision ${event.decisionId} not found`);
    }

    if (decision.organizationId !== event.organizationId || decision.workspaceId !== event.workspaceId) {
      // FAIL CLOSED. Tenant mismatch.
      throw new Error(`Tenant mismatch for Decision ${event.decisionId}`);
    }

    const correlation = await this.prisma.decisionCorrelation.findUnique({
      where: { correlationId: event.correlationId },
    });

    if (!correlation || !correlation.opportunityPayload) {
      throw new Error(`Correlation ${event.correlationId} or opportunityPayload not found`);
    }

    if (correlation.workspaceId !== event.workspaceId) {
      throw new Error(`Tenant mismatch for Correlation ${event.correlationId}`);
    }

    const opportunity = JSON.parse(correlation.opportunityPayload);
    
    // Enforce matching payload
    const orderType = opportunity.orderType || 'MARKET';
    const side = opportunity.side || 'BUY';
    const size = opportunity.size ? Number(opportunity.size) : 1.0;
    const requestedPrice = opportunity.price ? Number(opportunity.price) : null;
    const stopLoss = opportunity.stopLoss ? Number(opportunity.stopLoss) : null;
    const takeProfit = opportunity.takeProfit ? Number(opportunity.takeProfit) : null;

    // Deterministic UUID based on decisionId
    const orderId = uuidv5(event.decisionId, EXECUTION_NAMESPACE);
    
    const executionOrder = this.publisher.mergeObjectContext(
      new ExecutionOrder(
        orderId,
        event.workspaceId,
        event.organizationId,
        decision.accountId,
        decision.symbolId,
        event.decisionId,
        event.correlationId,
        orderType,
        side,
        size,
        requestedPrice,
        stopLoss,
        takeProfit,
      ),
    );

    executionOrder.create();

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.executionOrder.create({
          data: {
            id: orderId,
            workspaceId: event.workspaceId,
            organizationId: event.organizationId,
            accountId: decision.accountId,
            symbolId: decision.symbolId,
            decisionId: event.decisionId,
            correlationId: event.correlationId,
            orderType,
            side,
            size,
            requestedPrice,
            stopLoss,
            takeProfit,
            status: executionOrder.getStatus(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'EXECUTION_ORDER_CREATED',
            actorId: 'SYSTEM', // Established system actor convention
            targetEntityId: orderId,
            targetEntityType: 'ExecutionOrder',
            newState: 'PENDING',
            correlationId: event.correlationId,
            organizationId: event.organizationId,
            workspaceId: event.workspaceId,
            reason: 'Policy Decision Resolved to ALLOW',
          },
        });

        await this.outboxService.saveEvents(tx, 'ExecutionOrder', executionOrder.id, executionOrder);
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as Error & { code?: string };
        if (err.code === 'P2002') {
          // Idempotent drop - already created
          console.log(`ExecutionOrder for Decision ${event.decisionId} already exists. Dropping duplicate.`);
          return;
        }
      }
      throw error;
    }
  }
}
