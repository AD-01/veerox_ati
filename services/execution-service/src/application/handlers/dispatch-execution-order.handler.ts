import { EventsHandler, IEventHandler, EventPublisher } from '@nestjs/cqrs';
import { ExecutionOrderCreatedEvent, ConnectorCommandIssuedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { ExecutionOrder } from '../../domain/aggregates/execution-order.aggregate';
import { v5 as uuidv5 } from 'uuid';

const COMMAND_NAMESPACE = '7ba7b810-9dad-11d1-80b4-00c04fd430c9';

@EventsHandler(ExecutionOrderCreatedEvent)
export class DispatchExecutionOrderHandler implements IEventHandler<ExecutionOrderCreatedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async handle(event: ExecutionOrderCreatedEvent) {
    // Tenant Isolation
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: event.accountId },
    });

    if (!account) {
      throw new Error(`TradingAccount ${event.accountId} not found for ExecutionOrder ${event.orderId}`);
    }

    if (account.organizationId !== event.organizationId || account.workspaceId !== event.workspaceId) {
      throw new Error(`Tenant mismatch for TradingAccount ${event.accountId}`);
    }

    if (account.executionHalted) {
      if (event.orderType !== 'CLOSE' && event.orderType !== 'RECONCILE' && event.orderType !== 'HEARTBEAT' && event.orderType !== 'RECOVERY') {
        // Track H: Audit log the kill switch rejection
        await this.prisma.auditLog.create({
          data: {
            action: 'KILL_SWITCH_REJECTION',
            actorId: 'SYSTEM',
            targetEntityId: event.orderId,
            targetEntityType: 'ExecutionOrder',
            previousState: 'PENDING',
            newState: 'REJECTED',
            correlationId: event.correlationId,
            organizationId: event.organizationId,
            workspaceId: event.workspaceId,
            reason: `Execution halted for TradingAccount ${account.id}. Blocked order type: ${event.orderType}`,
          },
        });
        throw new Error(`Execution halted for TradingAccount ${account.id}. Blocked order type: ${event.orderType}`);
      }
    }

    const symbol = await this.prisma.symbol.findUnique({
      where: { id: event.symbolId },
    });

    if (!symbol) {
      throw new Error(`Symbol ${event.symbolId} not found for ExecutionOrder ${event.orderId}`);
    }

    // Deterministic Idempotency
    const connectorCommandId = uuidv5(event.orderId, COMMAND_NAMESPACE);

    const payload = {
      orderId: event.orderId,
      symbol: symbol.brokerSymbol,
      orderType: event.orderType,
      side: event.side,
      size: event.size,
      requestedPrice: event.requestedPrice,
      stopLoss: event.stopLoss,
      takeProfit: event.takeProfit,
    };

    const executionOrder = this.publisher.mergeObjectContext(
      new ExecutionOrder(
        event.orderId,
        event.workspaceId,
        event.organizationId,
        event.accountId,
        event.symbolId,
        event.decisionId,
        event.correlationId,
        event.orderType,
        event.side,
        event.size,
        event.requestedPrice,
        event.stopLoss,
        event.takeProfit,
      ),
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (executionOrder as any).status = 'PENDING';

    executionOrder.dispatch(connectorCommandId);

    const now = new Date();
    // Default manual trade expiration: 30 seconds
    const expiresAt = new Date(now.getTime() + 30 * 1000);

    const issuedEvent = new ConnectorCommandIssuedEvent(
      connectorCommandId,
      account.connectorId,
      event.workspaceId,
      'TRADE_EXECUTE',
      JSON.stringify(payload),
      now,
      expiresAt,
    );
    executionOrder.apply(issuedEvent);

    // Atomic Dispatch Transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // Only transition if currently PENDING. Returns 0 if already dispatched or failed.
        const updateResult = await tx.executionOrder.updateMany({
          where: { 
            id: event.orderId,
            status: 'PENDING'
          },
          data: {
            status: executionOrder.getStatus(),
            connectorCommandId,
          },
        });

        if (updateResult.count === 0) {
          throw new Error('Order is not in PENDING state or does not exist (possibly already dispatched).');
        }

        // Monotonic sequence allocation
        const updatedAccount = await tx.tradingAccount.update({
          where: { id: account.id },
          data: { nextCommandSequence: { increment: 1 } },
          select: { nextCommandSequence: true },
        });
        
        // The assigned sequence is the value before incrementing
        const assignedSequence = updatedAccount.nextCommandSequence - 1;

        await (tx.connectorCommand.create as any)({
          data: {
            id: connectorCommandId,
            connectorId: account.connectorId,
            accountId: account.id,
            accountSequence: assignedSequence,
            clientExecutionId: event.orderId,
            commandType: 'TRADE_EXECUTE',
            payloadJson: JSON.stringify(payload),
            status: 'PENDING',
            expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'EXECUTION_ORDER_DISPATCHED',
            actorId: 'SYSTEM',
            targetEntityId: event.orderId,
            targetEntityType: 'ExecutionOrder',
            previousState: 'PENDING',
            newState: 'DISPATCHED',
            correlationId: event.correlationId,
            organizationId: event.organizationId,
            workspaceId: event.workspaceId,
            reason: `Dispatched to Connector ${account.connectorId}`,
          },
        });

        await this.outboxService.saveEvents(tx, 'ExecutionOrder', executionOrder.id, executionOrder);
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as Error & { code?: string };
        if (err.code === 'P2002' || err.message.includes('not in PENDING state')) {
          // Idempotent drop
          console.log(`Order ${event.orderId} already dispatched or in invalid state. Dropping duplicate dispatch.`);
          return;
        }
      }
      throw error;
    }
  }
}
