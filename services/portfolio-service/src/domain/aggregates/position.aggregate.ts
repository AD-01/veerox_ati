import { AggregateRoot } from '@nestjs/cqrs';
import Decimal from 'decimal.js';
import {
  PortfolioPositionOpenedEvent,
  PortfolioPositionUpdatedEvent,
  PortfolioPositionClosedEvent,
} from '@veerox/events';

export class PositionAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly symbolId: string,
    public side: string,
    public quantity: Decimal,
    public averageEntryPrice: Decimal,
    public realizedPnl: Decimal,
    public unrealizedPnl: Decimal,
    public status: string,
    public openedAt: Date,
    public closedAt: Date | null,
    public correlationId: string | null,
    public version: number,
  ) {
    super();
  }

  static create(
    id: string,
    organizationId: string,
    workspaceId: string,
    tradingAccountId: string,
    symbolId: string,
    side: string,
    quantity: Decimal,
    averageEntryPrice: Decimal,
    correlationId: string | null,
  ): PositionAggregate {
    const position = new PositionAggregate(
      id,
      organizationId,
      workspaceId,
      tradingAccountId,
      symbolId,
      side,
      quantity,
      averageEntryPrice,
      new Decimal(0),
      new Decimal(0),
      'OPEN',
      new Date(),
      null,
      correlationId,
      1,
    );

    position.apply(
      new PortfolioPositionOpenedEvent(
        position.id,
        position.organizationId,
        position.workspaceId,
        position.tradingAccountId,
        position.symbolId,
        position.side,
        position.quantity.toNumber(),
        position.averageEntryPrice.toNumber(),
        position.correlationId,
        position.openedAt,
      ),
    );

    return position;
  }

  increaseQuantity(addedQuantity: Decimal, fillPrice: Decimal, correlationId: string | null) {
    // Weighted average price
    const currentTotalValue = this.quantity.mul(this.averageEntryPrice);
    const addedValue = addedQuantity.mul(fillPrice);
    
    this.quantity = this.quantity.plus(addedQuantity);
    this.averageEntryPrice = currentTotalValue.plus(addedValue).div(this.quantity);
    this.correlationId = correlationId;
    this.version += 1;

    this.apply(
      new PortfolioPositionUpdatedEvent(
        this.id,
        this.organizationId,
        this.workspaceId,
        this.tradingAccountId,
        this.symbolId,
        this.side,
        this.quantity.toNumber(),
        this.averageEntryPrice.toNumber(),
        this.realizedPnl.toNumber(),
        this.correlationId,
        new Date(),
      )
    );
  }

  decreaseQuantity(reducedQuantity: Decimal, fillPrice: Decimal, contractSize: Decimal, correlationId: string | null): Decimal {
    if (reducedQuantity.gt(this.quantity)) {
      throw new Error('Cannot reduce quantity below zero in netting mode.');
    }

    const tradePnl = this.calculateRealizedPnl(reducedQuantity, fillPrice, contractSize);
    this.realizedPnl = this.realizedPnl.plus(tradePnl);
    this.quantity = this.quantity.minus(reducedQuantity);
    this.correlationId = correlationId;
    this.version += 1;

    if (this.quantity.eq(0)) {
      this.status = 'CLOSED';
      this.closedAt = new Date();
      this.apply(
        new PortfolioPositionClosedEvent(
          this.id,
          this.organizationId,
          this.workspaceId,
          this.tradingAccountId,
          this.symbolId,
          this.side,
          this.realizedPnl.toNumber(),
          this.correlationId,
          this.closedAt,
        )
      );
    } else {
      this.apply(
        new PortfolioPositionUpdatedEvent(
          this.id,
          this.organizationId,
          this.workspaceId,
          this.tradingAccountId,
          this.symbolId,
          this.side,
          this.quantity.toNumber(),
          this.averageEntryPrice.toNumber(),
          this.realizedPnl.toNumber(),
          this.correlationId,
          new Date(),
        )
      );
    }

    return tradePnl;
  }

  private calculateRealizedPnl(closeQuantity: Decimal, closePrice: Decimal, contractSize: Decimal): Decimal {
    if (this.side === 'BUY') {
      return closePrice.minus(this.averageEntryPrice).mul(closeQuantity).mul(contractSize);
    } else if (this.side === 'SELL') {
      return this.averageEntryPrice.minus(closePrice).mul(closeQuantity).mul(contractSize);
    }
    return new Decimal(0);
  }
}
