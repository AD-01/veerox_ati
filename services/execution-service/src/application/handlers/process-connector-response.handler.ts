import { EventsHandler, IEventHandler, EventPublisher } from '@nestjs/cqrs';
import { ConnectorResponseReceivedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { ExecutionOrder } from '../../domain/aggregates/execution-order.aggregate';

@EventsHandler(ConnectorResponseReceivedEvent)
export class ProcessConnectorResponseHandler implements IEventHandler<ConnectorResponseReceivedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async handle(event: ConnectorResponseReceivedEvent) {
    // Look up command directly first to verify connector ownership
    const command = await this.prisma.connectorCommand.findUnique({
      where: { id: event.commandId },
    });

    if (!command) {
      console.log(`ConnectorCommand ${event.commandId} not found.`);
      return;
    }

    if (command.connectorId !== event.connectorId) {
      // FAIL CLOSED. Cross-connector forgery attempt
      throw new Error(`Connector Security Violation: Response connector ${event.connectorId} does not match command connector ${command.connectorId}`);
    }

    const orderData = await this.prisma.executionOrder.findFirst({
      where: { connectorCommandId: event.commandId },
    });

    if (!orderData) {
      return;
    }

    const executionOrder = this.publisher.mergeObjectContext(
      new ExecutionOrder(
        orderData.id,
        orderData.workspaceId,
        orderData.organizationId,
        orderData.accountId,
        orderData.symbolId,
        orderData.decisionId,
        orderData.correlationId,
        orderData.orderType,
        orderData.side,
        Number(orderData.size),
        orderData.requestedPrice ? Number(orderData.requestedPrice) : null,
        orderData.stopLoss ? Number(orderData.stopLoss) : null,
        orderData.takeProfit ? Number(orderData.takeProfit) : null,
      ),
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (executionOrder as any).status = orderData.status;
    executionOrder['connectorCommandId'] = orderData.connectorCommandId;

    if (event.responseCode === 'SUCCESS' || event.responseCode === 'FILLED') {
      let executedPrice = 0;
      if (event.payloadJson) {
        try {
          const payload = JSON.parse(event.payloadJson);
          executedPrice = payload.executedPrice || 0;
        } catch (e) {
          console.error('Failed to parse connector response payload', e);
        }
      }
      executionOrder.fill(executedPrice);
    } else if (event.responseCode === 'REJECTED') {
      executionOrder.reject(event.responseMessage || 'Broker rejected');
    } else {
      executionOrder.fail(event.responseMessage || 'Unknown failure');
    }

    // Atomic DB transition
    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.executionOrder.updateMany({
        where: {
          id: orderData.id,
          status: 'DISPATCHED', // MUST currently be dispatched
        },
        data: {
          status: executionOrder.getStatus(),
          executedPrice: executionOrder.getExecutedPrice(),
          failureReason: executionOrder.getFailureReason(),
          completedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        console.log(`Order ${orderData.id} already processed or not in DISPATCHED state. Dropping duplicate response.`);
        return;
      }

      // Audit Logging
      await tx.auditLog.create({
        data: {
          action: `EXECUTION_ORDER_${executionOrder.getStatus()}`,
          actorId: event.connectorId,
          targetEntityId: orderData.id,
          targetEntityType: 'ExecutionOrder',
          previousState: 'DISPATCHED',
          newState: executionOrder.getStatus(),
          correlationId: orderData.correlationId,
          organizationId: orderData.organizationId,
          workspaceId: orderData.workspaceId,
          reason: event.responseMessage || `Response from Connector`,
        },
      });

      await this.outboxService.saveEvents(tx, 'ExecutionOrder', executionOrder.id, executionOrder);
    });
  }
}
