import { AggregateRoot } from '@nestjs/cqrs';
import Decimal from 'decimal.js';
import { AccountBalanceUpdatedEvent } from '@veerox/events';

export class TradingAccountAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly connectorId: string,
    public readonly currency: string,
    public balance: Decimal,
    public equity: Decimal,
    public realizedPnl: Decimal,
    public unrealizedPnl: Decimal,
    public marginUsed: Decimal,
    public freeMargin: Decimal,
    public version: number,
  ) {
    super();
  }

  applyRealizedPnl(tradePnl: Decimal, correlationId: string | null) {
    this.realizedPnl = this.realizedPnl.plus(tradePnl);
    this.balance = this.balance.plus(tradePnl);
    
    // Simplistic update for free margin and equity.
    // In reality, this requires recalculating open positions' unrealized PnL.
    this.equity = this.balance.plus(this.unrealizedPnl);
    this.freeMargin = this.equity.minus(this.marginUsed);
    this.version += 1;

    this.apply(
      new AccountBalanceUpdatedEvent(
        this.id,
        this.organizationId,
        this.workspaceId,
        this.balance.toNumber(),
        this.equity.toNumber(),
        this.realizedPnl.toNumber(),
        this.freeMargin.toNumber(),
        correlationId,
        new Date(),
      )
    );
  }
}
