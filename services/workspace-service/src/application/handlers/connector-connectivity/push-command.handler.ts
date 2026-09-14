import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ConnectorCommandIssuedEvent } from '@veerox/events';
import { ConnectorGateway } from '../../../infrastructure/websockets/connector.gateway';

import { PrismaService } from '@veerox/database';

@EventsHandler(ConnectorCommandIssuedEvent)
export class PushCommandHandler implements IEventHandler<ConnectorCommandIssuedEvent> {
  constructor(
    private readonly gateway: ConnectorGateway,
    private readonly prisma: PrismaService,
  ) {}

  async handle(event: ConnectorCommandIssuedEvent) {
    if (event.expiresAt && new Date(event.expiresAt).getTime() < Date.now()) {
      // Command has expired before being pushed. Update DB transactionally.
      console.warn(`Command ${event.commandId} expired before push. Marking as EXPIRED.`);
      await this.prisma.$transaction(async (tx) => {
        const commandResult = await tx.connectorCommand.updateMany({
          where: { id: event.commandId, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });

        if (commandResult.count > 0 && event.payloadJson) {
           try {
             const parsed = JSON.parse(event.payloadJson);
             if (parsed.orderId) {
               const orderResult = await tx.executionOrder.updateMany({
                 where: { id: parsed.orderId, status: { in: ['PENDING', 'DISPATCHED'] } },
                 data: { status: 'EXPIRED', failureReason: 'Command TTL expired before dispatch' }
               });

               if (orderResult.count > 0) {
                 const order = await tx.executionOrder.findUnique({ where: { id: parsed.orderId } });
                 if (order) {
                   const { randomUUID } = require('crypto');
                   const eventEnvelope = {
                     eventId: randomUUID(),
                     eventType: 'OrderStateChanged',
                     timestamp: new Date().toISOString(),
                     aggregateId: order.id,
                     organizationId: order.organizationId,
                     workspaceId: order.workspaceId,
                     payload: {
                       orderId: order.id,
                       tradingAccountId: order.accountId,
                       orderType: order.orderType,
                       side: order.side,
                       status: order.status,
                       size: Number(order.size),
                       executedSize: Number((order as any).executedSize),
                       remainingSize: Number((order as any).remainingSize),
                       executedPrice: order.executedPrice ? Number(order.executedPrice) : undefined,
                       brokerOrderId: (order as any).brokerOrderId,
                       failureReason: order.failureReason,
                     }
                   };

                   await tx.outboxMessage.create({
                     data: {
                       aggregateType: 'ExecutionOrder',
                       aggregateId: order.id,
                       eventType: 'OrderStateChanged',
                       payload: eventEnvelope as any,
                       organizationId: order.organizationId,
                       workspaceId: order.workspaceId,
                     }
                   });
                 }
               }
             }
           } catch(e) {
             console.error(`Failed to parse payload for EXPIRED command ${event.commandId}`, e);
           }
        }
      });
      return;
    }

    const payload = JSON.parse(event.payloadJson);

    // Reconstruct the Canonical Envelope
    const envelope = {
      type: 'COMMAND', // Note: could be specific if required by s22, e.g. TRADE_EXECUTE
      messageId: event.commandId,
      commandId: event.commandId,
      commandType: event.commandType,
      workspaceId: event.workspaceId,
      expiresAt: event.expiresAt ? new Date(event.expiresAt).getTime() : undefined, // Send as epoch ms for MT5
      payload,
    };

    await this.prisma.connectorCommand.updateMany({
      where: { id: event.commandId, status: 'PENDING' },
      data: { status: 'DISPATCHED' }
    });

    this.gateway.pushCommand(event.connectorId, envelope);
  }
}
