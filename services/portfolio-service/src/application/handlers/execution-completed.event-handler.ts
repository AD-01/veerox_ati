import { EventsHandler, IEventHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ExecutionOrderCompletedEvent } from '@veerox/events';
import { OutboxService } from '@veerox/shared';
import { TRADING_ACCOUNT_REPOSITORY, ITradingAccountRepository } from '../../infrastructure/repositories/trading-account.repository';
import { POSITION_REPOSITORY, IPositionRepository } from '../../infrastructure/repositories/position.repository';
import { PortfolioLedgerService } from '../../domain/services/portfolio-ledger.service';
import { PrismaService } from '@veerox/database';

@EventsHandler(ExecutionOrderCompletedEvent)
export class ExecutionCompletedEventHandler implements IEventHandler<ExecutionOrderCompletedEvent> {
  private readonly logger = new Logger(ExecutionCompletedEventHandler.name);

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

  async handle(event: ExecutionOrderCompletedEvent) {
    this.logger.log(`Handling ExecutionOrderCompletedEvent for order ${event.orderId}`);

    if (!event.symbolId || !event.side || !event.size) {
      this.logger.error(`Execution event missing critical financial payload (symbol, side, size) for order ${event.orderId}. Ensure backward compatible event extensions are published.`);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
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
        const { account: updatedAccount, position: updatedPosition, tradePnl } = this.ledgerService.processFill(
          account,
          activePosition,
          symbol.id,
          contractSize,
          event.side!,
          event.size!,
          event.executedPrice,
          event.correlationId || null
        );

        // 5. Create PortfolioTransaction (Idempotency check happens here via @@unique on executionOrderId)
        await tx.portfolioTransaction.create({
          data: {
            organizationId: account.organizationId,
            workspaceId: account.workspaceId,
            tradingAccountId: account.id,
            executionOrderId: event.orderId,
            type: 'TRADE_FILL',
            amount: event.size!,
            currency: account.currency,
            balanceBefore: account.balance.toNumber(),
            balanceAfter: updatedAccount.balance.toNumber(),
            realizedPnl: tradePnl.toNumber(),
          },
        });

        // 6. Save State (Optimistic Locking)
        await this.positionRepo.save(updatedPosition, tx);
        await this.accountRepo.save(updatedAccount, tx);

        // 7. Audit Log
        await tx.auditLog.create({
          data: {
            actorId: null,
            targetUserId: null,
            action: activePosition ? 'POSITION_UPDATED' : 'POSITION_OPENED',
            previousState: activePosition ? JSON.stringify({ quantity: activePosition.quantity, status: activePosition.status }) as any : null,
            newState: JSON.stringify({ quantity: updatedPosition.quantity, status: updatedPosition.status, pnl: tradePnl }) as any,
            correlationId: event.correlationId,
            organizationId: account.organizationId,
            workspaceId: account.workspaceId,
            targetEntityId: updatedPosition.id,
            targetEntityType: 'Position',
          }
        });

        // 8. Commit Events using Outbox (Transactional)
        await this.outboxService.saveEvents(tx, 'Position', updatedPosition.id, updatedPosition);
        await this.outboxService.saveEvents(tx, 'TradingAccount', updatedAccount.id, updatedAccount);
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.warn(`Idempotency skip: Execution order ${event.orderId} already processed.`);
        return;
      }
      this.logger.error(`Failed to process execution completion: ${error.message}`);
      throw error;
    }
  }
}
