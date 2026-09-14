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

    if (orderData.status === 'FILLED' || orderData.status === 'FAILED' || orderData.status === 'REJECTED') {
      console.log(`Order ${orderData.id} is in terminal state ${orderData.status}. Dropping late response.`);
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
    const orderDataAny = orderData as any;
    executionOrder.executedSize = Number(orderDataAny.executedSize) || 0;
    executionOrder.remainingSize = Number(orderDataAny.remainingSize) || Number(orderDataAny.size);
    executionOrder.brokerOrderId = orderDataAny.brokerOrderId;
    executionOrder.brokerTicketId = orderDataAny.brokerTicketId;
    executionOrder.magicNumber = orderDataAny.magicNumber;
    if (event.responseCode === 'SUCCESS' || event.responseCode === 'FILLED' || event.responseCode === 'PARTIALLY_FILLED') {
      let executedPrice = 0;
      let executedSize = executionOrder.remainingSize;
      let brokerOrderId = undefined;
      let brokerTicketId = undefined;
      let commission = undefined;
      let swap = undefined;
      let realizedPnl = undefined;
      let brokerDealId = undefined;

      if (event.payloadJson) {
        try {
          const payload = JSON.parse(event.payloadJson);
          executedPrice = payload.executedPrice || 0;
          if (payload.executedSize !== undefined) {
            executedSize = payload.executedSize;
          }
          brokerOrderId = payload.brokerOrderId;
          brokerTicketId = payload.brokerTicketId;
          brokerDealId = payload.brokerDealId;
          commission = payload.commission;
          swap = payload.swap;
          realizedPnl = payload.realizedPnl;
        } catch (e) {
          console.error('Failed to parse connector response payload', e);
        }
      }
      // Temporarily piggyback brokerDealId inside magicNumber field just to pass it through if needed, or we just rely on event.payloadJson below
      executionOrder.fill(executedPrice, executedSize, brokerOrderId, brokerTicketId, commission, swap, realizedPnl);
    } else if (event.responseCode === 'REJECTED') {
      let reason = event.responseMessage || 'Broker rejected';
      if (reason.includes('10013')) reason = 'INVALID_STOPS';
      if (reason.includes('10015')) reason = 'INVALID_PRICE';
      if (reason.includes('10016')) reason = 'INVALID_STOPS';
      if (reason.includes('10019')) reason = 'INSUFFICIENT_MARGIN';
      if (reason.includes('10018')) reason = 'MARKET_CLOSED';
      executionOrder.reject(reason);
    } else {
      let reason = event.responseMessage || 'Unknown failure';
      if (reason.includes('MT5_UNAVAILABLE')) reason = 'MT5_UNAVAILABLE';
      executionOrder.fail(reason);
    }

    // Atomic DB transition
    try {
      await this.prisma.$transaction(async (tx) => {
        // Idempotency check via ExecutionFill
        if (event.responseCode === 'SUCCESS' || event.responseCode === 'FILLED' || event.responseCode === 'PARTIALLY_FILLED') {
          let commission = undefined;
          let swap = undefined;
          let realizedPnl = undefined;
          let brokerDealId = undefined;
          if (event.payloadJson) {
            try {
              const payload = JSON.parse(event.payloadJson);
              commission = payload.commission;
              swap = payload.swap;
              realizedPnl = payload.realizedPnl;
              brokerDealId = payload.brokerDealId;
            } catch { }
          }
          if (executionOrder.brokerTicketId) {
            await (tx.executionFill.create as any)({
              data: {
                executionOrderId: executionOrder.id,
                brokerTicketId: executionOrder.brokerTicketId,
                brokerDealId,
                clientExecutionId: event.responseId, // using responseId as idempotency key
                brokerOrderId: executionOrder.brokerOrderId,
                executedSize: executionOrder.executedSize - (Number((orderData as any).executedSize) || 0), // The delta
                executedPrice: executionOrder.getExecutedPrice() || 0,
                commission,
                swap,
                realizedPnl
              }
            });
          }
        }

        const updateResult = await (tx.executionOrder.updateMany as any)({
          where: {
            id: orderData.id,
            status: { in: ['DISPATCHED', 'PARTIALLY_FILLED', 'AWAITING_RECONCILIATION'] }, 
          },
          data: {
          status: executionOrder.getStatus(),
          executedPrice: executionOrder.getExecutedPrice(),
          executedSize: executionOrder.executedSize,
          remainingSize: executionOrder.remainingSize,
          brokerOrderId: executionOrder.brokerOrderId,
          brokerTicketId: executionOrder.brokerTicketId,
          failureReason: executionOrder.getFailureReason(),
          completedAt: executionOrder.getStatus() === 'FILLED' ? new Date() : null,
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
          previousState: orderData.status,
          newState: executionOrder.getStatus(),
          correlationId: orderData.correlationId,
          organizationId: orderData.organizationId,
          workspaceId: orderData.workspaceId,
          reason: event.responseMessage || `Response from Connector`,
        },
      });

      await this.outboxService.saveEvents(tx, 'ExecutionOrder', executionOrder.id, executionOrder);
    });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2002'
      ) {
        console.warn(`Duplicate execution response for order ${orderData.id} (ExecutionFill idempotency). Dropping.`);
        return;
      }
      throw error;
    }
  }
}
