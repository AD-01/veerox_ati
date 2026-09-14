import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@veerox/database';
import { ExecutionOrderUncertainEvent } from '@veerox/events';

@Injectable()
export class ExecutionSweeperWorker {
  private readonly logger = new Logger(ExecutionSweeperWorker.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.sweepStaleOrders();
    } catch (error) {
      this.logger.error('Error sweeping stale execution orders', error);
    } finally {
      this.isRunning = false;
    }
  }

  async sweepStaleOrders() {
    // Orders older than 60 seconds are considered stale
    const timeoutThreshold = new Date(Date.now() - 60000);

    const staleOrders = await this.prisma.executionOrder.findMany({
      where: {
        status: { in: ['PENDING', 'DISPATCHED'] },
        createdAt: { lt: timeoutThreshold },
      },
      take: 100,
    });

    if (!staleOrders.length) return;

    for (const order of staleOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Atomically claim the order using updateMany with status check
          const updated = await tx.executionOrder.updateMany({
            where: {
              id: order.id,
              status: { in: ['PENDING', 'DISPATCHED'] },
            },
            data: {
              status: 'AWAITING_RECONCILIATION',
              failureReason: 'CONNECTOR_TIMEOUT',
              updatedAt: new Date(),
            },
          });

          if (updated.count === 1) {
            this.logger.warn(`ExecutionOrder ${order.id} timed out. Marking as AWAITING_RECONCILIATION.`);
            
            // S-24: Auto-dispatch RECONCILE command
            const tradingAccount = await tx.tradingAccount.findUnique({
              where: { id: order.accountId },
              select: { connectorId: true }
            });

            if (tradingAccount) {
              const command = await tx.connectorCommand.create({
                data: {
                  connectorId: tradingAccount.connectorId,
                  accountId: order.accountId,
                  commandType: 'RECONCILE',
                  payloadJson: JSON.stringify({
                    clientExecutionId: order.id,
                    orderId: order.id
                  }),
                  status: 'PENDING',
                  expiresAt: new Date(Date.now() + 5 * 60000), // 5 minute TTL
                  clientExecutionId: order.id // Using order ID as clientExecutionId for uniqueness
                } as any
              });

              await tx.outboxMessage.create({
                data: {
                  aggregateType: 'ConnectorCommand',
                  aggregateId: command.id,
                  eventType: 'ConnectorCommandIssuedEvent',
                  payload: {
                    commandId: command.id,
                    connectorId: command.connectorId,
                    commandType: command.commandType,
                    accountId: (command as any).accountId,
                    payloadJson: command.payloadJson,
                    timestamp: new Date().toISOString()
                  },
                  organizationId: order.organizationId,
                  workspaceId: order.workspaceId,
                }
              });
            }

            // S-21: Dispatch Uncertain event for the ledger so it doesn't create a false financial failure
            const event = new ExecutionOrderUncertainEvent(
              order.id,
              order.workspaceId,
              order.organizationId,
              order.accountId,
              'CONNECTOR_TIMEOUT',
              order.connectorCommandId,
              new Date(),
              order.symbolId,
              order.side,
              Number(order.size),
              order.correlationId
            );

            await tx.outboxMessage.create({
              data: {
                aggregateType: 'ExecutionOrder',
                aggregateId: order.id,
                eventType: 'ExecutionOrderUncertainEvent',
                payload: JSON.parse(JSON.stringify(event)),
                status: 'PENDING',
                correlationId: order.correlationId,
              },
            });

            // S-20: Create AuditLog for timeout failure
            await tx.auditLog.create({
              data: {
                organizationId: order.organizationId,
                workspaceId: order.workspaceId,
                actorId: 'SYSTEM',
                targetEntityType: 'ExecutionOrder',
                targetEntityId: order.id,
                action: 'EXECUTION_TIMEOUT_UNCERTAIN',
                correlationId: order.correlationId,
                reason: JSON.stringify({
                  timeoutDurationMs: 60000,
                  previousStatus: order.status,
                }),
              }
            });
          }
        });
      } catch (err) {
        this.logger.error(`Failed to sweep order ${order.id}`, err);
      }
    }

    // P1: Escalation for orders indefinitely stuck in AWAITING_RECONCILIATION
    const escalationThreshold = new Date(Date.now() - 5 * 60000); // 5 minutes
    const stuckOrders = await this.prisma.executionOrder.findMany({
      where: {
        status: 'AWAITING_RECONCILIATION',
        updatedAt: { lt: escalationThreshold },
      },
      take: 100,
    });

    if (stuckOrders.length > 0) {
      for (const order of stuckOrders) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const updated = await tx.executionOrder.updateMany({
              where: {
                id: order.id,
                status: 'AWAITING_RECONCILIATION',
              },
              data: {
                status: 'ESCALATED', // Escalate for manual review
                failureReason: 'ESCALATED_TIMEOUT',
                updatedAt: new Date(),
              },
            });

            if (updated.count === 1) {
              this.logger.error(`ExecutionOrder ${order.id} stuck in AWAITING_RECONCILIATION for 5m. Escalating to human review.`);
              
              await tx.auditLog.create({
                data: {
                  organizationId: order.organizationId,
                  workspaceId: order.workspaceId,
                  actorId: 'SYSTEM',
                  targetEntityType: 'ExecutionOrder',
                  targetEntityId: order.id,
                  action: 'EXECUTION_RECONCILIATION_ESCALATED',
                  correlationId: order.correlationId,
                  reason: JSON.stringify({
                    timeoutDurationMs: 300000,
                  }),
                }
              });
            }
          });
        } catch (err) {
          this.logger.error(`Failed to escalate order ${order.id}`, err);
        }
      }
    }
  }
}
