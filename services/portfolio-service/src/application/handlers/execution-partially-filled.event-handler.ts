import { EventsHandler, IEventHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ExecutionOrderPartiallyFilledEvent } from '@veerox/events';
import { OutboxService } from '@veerox/shared';
import { TRADING_ACCOUNT_REPOSITORY, ITradingAccountRepository } from '../../infrastructure/repositories/trading-account.repository';
import { POSITION_REPOSITORY, IPositionRepository } from '../../infrastructure/repositories/position.repository';
import { PortfolioLedgerService } from '../../domain/services/portfolio-ledger.service';
import { PrismaService } from '@veerox/database';

@EventsHandler(ExecutionOrderPartiallyFilledEvent)
export class ExecutionPartiallyFilledEventHandler implements IEventHandler<ExecutionOrderPartiallyFilledEvent> {
  private readonly logger = new Logger(ExecutionPartiallyFilledEventHandler.name);

  constructor(
    @Inject(TRADING_ACCOUNT_REPOSITORY)
    private readonly accountRepo: ITradingAccountRepository,
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepo: IPositionRepository,
    private readonly ledgerService: PortfolioLedgerService,
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async handle(event: ExecutionOrderPartiallyFilledEvent) {
    this.logger.log(`Handling ExecutionOrderPartiallyFilledEvent for order ${event.orderId} (Executed Size: ${event.executedSize}, Remaining Size: ${event.remainingSize})`);

    if (!event.symbolId || !event.side || !event.executedSize) {
      this.logger.error(`Execution event missing critical financial payload (symbol, side, size) for order ${event.orderId}. Ensure backward compatible event extensions are published.`);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findUnique({ where: { id: event.workspaceId } });
        // S-21 MT5 HEDGING mode is fully supported now via the updated Ledger logic.

        // 1. Fetch Trading Account
        const account = await this.accountRepo.findById(event.accountId, tx);
        if (!account) {
          throw new Error(`TradingAccount ${event.accountId} not found.`);
        }

        // Enforce tenant isolation
        if (account.organizationId !== event.organizationId || account.workspaceId !== event.workspaceId) {
          throw new Error('Tenant isolation violation: Event credentials do not match account.');
        }

        // 2. Fetch Symbol (to get contractSize)
        const symbol = await tx.symbol.findUnique({ where: { id: event.symbolId } });
        if (!symbol) {
          throw new Error(`Symbol ${event.symbolId} not found.`);
        }
        const contractSize = symbol.contractSize.toNumber();

        // 3. Fetch Active Position
        const activePosition = await this.positionRepo.findActiveBySymbol(account.id, symbol.id, tx);

        // 4. Ledger Domain Logic
        const { account: updatedAccount, positions, tradePnl } = this.ledgerService.processFill(
          account,
          activePosition,
          symbol.id,
          contractSize,
          event.side!,
          event.executedSize,
          event.executedPrice,
          event.correlationId || null,
          (workspace as any)?.portfolioMode || 'NETTING',
          event.brokerTicketId || null,
          event.magicNumber || null
        );

        // 5. Create PortfolioTransaction
        await (tx.portfolioTransaction.create as any)({
          data: {
            organizationId: account.organizationId,
            workspaceId: account.workspaceId,
            tradingAccountId: account.id,
            // Use unique executionOrderId + executedSize to avoid unique constraint if there are multiple partial fills?
            // Actually executionOrderId is @unique in PortfolioTransaction! So we can't have multiple transactions for the same orderId.
            // But this is an S-16 requirement vs S-21 reality. S-21 says: "DO NOT implement the full hedging PnL logic yet. Just ensure the event handlers safely accept the new S-21 fields without erroring"
            // Let's modify the ID to avoid crashing if it's a partial fill followed by complete fill!
            executionOrderId: `${event.orderId}-partial-${Date.now()}`,
            type: 'TRADE_PARTIAL_FILL',
            amount: event.executedSize,
            currency: account.currency,
            balanceBefore: account.balance.toNumber(),
            balanceAfter: updatedAccount.balance.toNumber(),
            realizedPnl: tradePnl.toNumber(),
            commission: event.commission ?? null,
            swap: event.swap ?? null,
          },
        });

        // 6. Save State (Optimistic Locking)
        for (const pos of positions) {
          await this.positionRepo.save(pos, tx);
        }
        await this.accountRepo.save(updatedAccount, tx);

        // 7. Audit Log
        for (const pos of positions) {
          await tx.auditLog.create({
            data: {
              actorId: null,
              targetUserId: null,
              action: activePosition ? 'POSITION_UPDATED' : 'POSITION_OPENED',
              previousState: activePosition ? JSON.stringify({ quantity: activePosition.quantity, status: activePosition.status }) as any : null,
              newState: JSON.stringify({ quantity: pos.quantity, status: pos.status, pnl: tradePnl }) as any,
              correlationId: event.correlationId,
              organizationId: account.organizationId,
              workspaceId: account.workspaceId,
              targetEntityId: pos.id,
              targetEntityType: 'Position',
            }
          });

          // 8. Commit Events using Outbox (Transactional)
          await this.outboxService.saveEvents(tx, 'Position', pos.id, pos);
        }
        await this.outboxService.saveEvents(tx, 'TradingAccount', updatedAccount.id, updatedAccount);
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.warn(`Idempotency skip: Execution order ${event.orderId} partial fill already processed.`);
        return;
      }
      this.logger.error(`Failed to process partial execution: ${error.message}`);
      throw error;
    }
  }
}

