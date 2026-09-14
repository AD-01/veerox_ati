import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { ReconcilePortfolioCommand, ExecutionOriginType } from '../commands/reconcile-portfolio.command';
import { PortfolioReconciliationCompletedEvent, PortfolioDiscrepancyDetectedEvent } from '@veerox/events';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';

@CommandHandler(ReconcilePortfolioCommand)
export class ReconcilePortfolioHandler implements ICommandHandler<ReconcilePortfolioCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: ReconcilePortfolioCommand) {
    const idempotencyKey = `${command.organizationId}_${command.workspaceId}_${command.tradingAccountId}_${command.externalSnapshotId}`;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check via DB unique constraint (P2002)
      let snapshot;
      try {
        snapshot = await tx.portfolioReconciliationSnapshot.create({
          data: {
            id: uuidv4(),
            organizationId: command.organizationId,
            workspaceId: command.workspaceId,
            tradingAccountId: command.tradingAccountId,
            externalSnapshotId: command.externalSnapshotId,
            idempotencyKey,
            snapshotTimestamp: command.snapshotTimestamp,
            status: 'PROCESSING',
            payloadJson: JSON.stringify({
              positions: command.positions,
              balance: command.balance,
              equity: command.equity,
            }),
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.warn(`Duplicate PortfolioReconciliationSnapshot for ${idempotencyKey}. Dropping.`);
          return;
        }
        throw error;
      }

      // 2. Fetch Internal State
      const internalPositions = await tx.position.findMany({
        where: {
          tradingAccountId: command.tradingAccountId,
          status: 'OPEN',
        },
      });

      const tradingAccount = await tx.tradingAccount.findUnique({
        where: { id: command.tradingAccountId },
      });

      if (!tradingAccount) {
        throw new Error('TradingAccount not found');
      }

      // Track A & B: Resolve Uncertain Executions (AWAITING_RECONCILIATION)
      const uncertainOrders = await tx.executionOrder.findMany({
        where: {
          accountId: command.tradingAccountId,
          status: 'AWAITING_RECONCILIATION',
        },
      });

      for (const order of uncertainOrders) {
        // Try to find the exact broker position that corresponds to this uncertain execution
        // We match by clientExecutionId (order.id) or brokerTicketId (order.connectorCommandId)
        const extMatch = command.positions.find(
          (p) =>
            p.clientExecutionId === order.id ||
            p.brokerTicketId === order.connectorCommandId ||
            ((order as any).brokerTicketId && p.brokerTicketId === (order as any).brokerTicketId) ||
            p.brokerOrderId === (order as any).brokerOrderId
        );

        if (extMatch) {
          // Found it! The order executed on the broker.
          const updateResult = await (tx.executionOrder.updateMany as any)({
            where: { id: order.id, status: 'AWAITING_RECONCILIATION' },
            data: { 
              status: 'FILLED', 
              executedSize: extMatch.quantity,
              executedPrice: extMatch.executedPrice || extMatch.averageEntryPrice || order.requestedPrice || 0,
              brokerTicketId: extMatch.brokerTicketId || null,
              brokerOrderId: extMatch.brokerOrderId || null,
              completedAt: new Date()
            },
          });

          if (updateResult.count > 0) {
            // Create ExecutionFill to lock it in and prevent duplicate fills
            try {
              await (tx.executionFill.create as any)({
                data: {
                  executionOrderId: order.id,
                  brokerTicketId: extMatch.brokerTicketId || `REC_${order.id}`,
                  clientExecutionId: snapshot.id, // Using snapshot id as unique execution fill idempotency
                  brokerOrderId: extMatch.brokerOrderId,
                  executedSize: new Decimal(extMatch.quantity).toNumber(),
                  executedPrice: new Decimal(extMatch.averageEntryPrice || 0).toNumber(),
                },
              });
            } catch (err: any) {
              if (err.code !== 'P2002') throw err; // Safe ignore if already filled
            }
            
            // Audit Log
            await tx.auditLog.create({
              data: {
                action: 'EXECUTION_ORDER_FILLED',
                actorId: 'SYSTEM',
                targetEntityId: order.id,
                targetEntityType: 'ExecutionOrder',
                previousState: 'AWAITING_RECONCILIATION',
                newState: 'FILLED',
                correlationId: order.correlationId,
                organizationId: order.organizationId,
                workspaceId: order.workspaceId,
                reason: 'Resolved via Broker Reconciliation Snapshot',
              },
            });
          }
        } else {
          // Missing from broker snapshot. 
          // If it was a BUY/SELL (opening) order and we have passed a 30-sec grace period since snapshot vs order creation, it FAILED.
          // If it was a CLOSE order and it's missing, it FILLED (successfully closed the position).
          const elapsed = command.snapshotTimestamp.getTime() - order.createdAt.getTime();
          
          if (elapsed > 30000) {
            if (order.orderType === 'CLOSE') {
              const updateResult = await tx.executionOrder.updateMany({
                where: { id: order.id, status: 'AWAITING_RECONCILIATION' },
                data: { status: 'FILLED', completedAt: new Date() },
              });
              if (updateResult.count > 0) {
                await tx.auditLog.create({
                  data: {
                    action: 'EXECUTION_ORDER_FILLED',
                    actorId: 'SYSTEM',
                    targetEntityId: order.id,
                    targetEntityType: 'ExecutionOrder',
                    previousState: 'AWAITING_RECONCILIATION',
                    newState: 'FILLED',
                    correlationId: order.correlationId,
                    organizationId: order.organizationId,
                    workspaceId: order.workspaceId,
                    reason: 'CLOSE Order successfully resolved via absence in Broker Snapshot',
                  },
                });
              }
            } else {
              const updateResult = await tx.executionOrder.updateMany({
                where: { id: order.id, status: 'AWAITING_RECONCILIATION' },
                data: { status: 'FAILED', failureReason: 'Uncertain execution missing from authoritative broker snapshot', completedAt: new Date() },
              });
              if (updateResult.count > 0) {
                await tx.auditLog.create({
                  data: {
                    action: 'EXECUTION_ORDER_FAILED',
                    actorId: 'SYSTEM',
                    targetEntityId: order.id,
                    targetEntityType: 'ExecutionOrder',
                    previousState: 'AWAITING_RECONCILIATION',
                    newState: 'FAILED',
                    correlationId: order.correlationId,
                    organizationId: order.organizationId,
                    workspaceId: order.workspaceId,
                    reason: 'Failed to find trade in Broker Snapshot',
                  },
                });
              }
            }
          }
        }
      }

      // 3. Compare Positions (Track D & E)
      const discrepancies: any[] = [];
      let discrepancyCount = 0;

      const extPosMap = new Map(command.positions.map(p => [p.brokerTicketId || p.clientExecutionId || p.brokerOrderId || `${p.symbolId}_${p.side}`, p]));
      const intPosMap = new Map(internalPositions.map(p => [(p as any).brokerTicketId || `${p.symbolId}_${p.side}`, p]));

      // Check for missing internal or value mismatches
      for (const [key, ext] of extPosMap.entries()) {
        const intPos = intPosMap.get(key);
        
        if (!intPos) {
          // Track E: Manual Intervention / EA Coexistence
          let discType = 'EXTERNAL_POSITION_NOT_IN_INTERNAL';
          
          if (ext.origin === ExecutionOriginType.MANUAL) {
            discType = 'MANUAL_TRADE_DETECTED';
          } else if (ext.origin === ExecutionOriginType.EXTERNAL_EA) {
            discType = 'EXTERNAL_EA_TRADE_DETECTED';
          }

          discrepancies.push({
            type: discType,
            symbolId: ext.symbolId,
            extVal: JSON.stringify({ ...ext, origin: ext.origin || ExecutionOriginType.UNKNOWN }),
            intVal: null,
          });
          discrepancyCount++;
        } else {
          // Compare size with Decimal
          if (!new Decimal(intPos.quantity).equals(new Decimal(ext.quantity))) {
            discrepancies.push({
              type: 'POSITION_SIZE_MISMATCH',
              symbolId: ext.symbolId,
              positionId: intPos.id,
              extVal: JSON.stringify({ quantity: ext.quantity }),
              intVal: JSON.stringify({ quantity: intPos.quantity }),
            });
            discrepancyCount++;
          }
          
          // Track C: Full Financial Reconciliation
          if (ext.executedPrice != null && !new Decimal(intPos.averageEntryPrice).equals(new Decimal(ext.executedPrice))) {
            discrepancies.push({
              type: 'EXECUTION_PRICE_MISMATCH',
              symbolId: ext.symbolId,
              positionId: intPos.id,
              extVal: JSON.stringify({ executedPrice: ext.executedPrice }),
              intVal: JSON.stringify({ averageEntryPrice: intPos.averageEntryPrice }),
            });
            discrepancyCount++;
          }

          if (ext.realizedPnl !== undefined && !new Decimal(intPos.realizedPnl || 0).equals(new Decimal(ext.realizedPnl))) {
            discrepancies.push({
              type: 'REALIZED_PNL_MISMATCH',
              symbolId: ext.symbolId,
              positionId: intPos.id,
              extVal: JSON.stringify({ realizedPnl: ext.realizedPnl }),
              intVal: JSON.stringify({ realizedPnl: intPos.realizedPnl }),
            });
            discrepancyCount++;
          }
          
          if (ext.commission !== undefined) {
             // If internal tracks commission... (assuming no internal column for now, but emit discrepancy if we add it)
          }
        }
      }

      // Check for missing external (Platform thinks we are open, Broker says closed)
      for (const [key, intPos] of intPosMap.entries()) {
        if (!extPosMap.has(key)) {
          discrepancies.push({
            type: 'INTERNAL_POSITION_NOT_IN_EXTERNAL',
            symbolId: intPos.symbolId,
            positionId: intPos.id,
            extVal: null,
            intVal: JSON.stringify({ quantity: intPos.quantity, side: intPos.side }),
          });
          discrepancyCount++;
        }
      }

      // 4. Compare Balances (Alert on significant diff using Decimal)
      if (Math.abs(new Decimal(tradingAccount.balance).minus(new Decimal(command.balance)).toNumber()) > 0.01) {
        discrepancies.push({
          type: 'BALANCE_MISMATCH',
          symbolId: null,
          extVal: JSON.stringify({ balance: command.balance }),
          intVal: JSON.stringify({ balance: tradingAccount.balance }),
        });
        discrepancyCount++;
      }

      // 5. Persist Snapshot and Discrepancies
      const snapshotStatus = discrepancyCount > 0 ? 'ANOMALIES_DETECTED' : 'COMPLETED';

      await tx.portfolioReconciliationSnapshot.update({
        where: { id: snapshot.id },
        data: { status: snapshotStatus },
      });

      for (const disc of discrepancies) {
        const discId = uuidv4();
        await (tx.portfolioReconciliationDiscrepancy.create as any)({
          data: {
            id: discId,
            organizationId: command.organizationId,
            workspaceId: command.workspaceId,
            snapshotId: snapshot.id,
            tradingAccountId: command.tradingAccountId,
            discrepancyType: disc.type,
            symbolId: disc.symbolId,
            positionId: disc.positionId,
            internalValue: disc.intVal,
            externalValue: disc.extVal,
            status: 'UNRESOLVED',
          },
        });

        // Emit Discrepancy Event via Outbox
        const discEvent = new PortfolioDiscrepancyDetectedEvent(
          discId,
          snapshot.id,
          command.organizationId,
          command.workspaceId,
          command.tradingAccountId,
          disc.type,
          disc.symbolId,
          disc.intVal,
          disc.extVal,
          disc.positionId
        );

        await tx.outboxMessage.create({
          data: {
            aggregateType: 'PortfolioReconciliation',
            aggregateId: snapshot.id,
            eventType: 'PortfolioDiscrepancyDetectedEvent',
            payload: JSON.parse(JSON.stringify(discEvent)),
            status: 'PENDING',
          },
        });
      }

      // Emit Completed Event via Outbox
      const compEvent = new PortfolioReconciliationCompletedEvent(
        snapshot.id,
        command.organizationId,
        command.workspaceId,
        command.tradingAccountId,
        snapshotStatus,
        discrepancyCount,
        new Date()
      );

      await tx.outboxMessage.create({
        data: {
          aggregateType: 'PortfolioReconciliation',
          aggregateId: snapshot.id,
          eventType: 'PortfolioReconciliationCompletedEvent',
          payload: JSON.parse(JSON.stringify(compEvent)),
          status: 'PENDING',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: command.organizationId,
          workspaceId: command.workspaceId,
          actorId: 'SYSTEM',
          targetEntityType: 'PortfolioReconciliationSnapshot',
          targetEntityId: snapshot.id,
          action: 'PORTFOLIO_RECONCILIATION_PROCESSED',
          reason: JSON.stringify({
            tradingAccountId: command.tradingAccountId,
            discrepancyCount,
            status: snapshotStatus,
          }),
        },
      });
    });
  }
}
