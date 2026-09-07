import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@nestjs/cqrs';
import Decimal from 'decimal.js';
import { PositionAggregate } from '../aggregates/position.aggregate';
import { TradingAccountAggregate } from '../aggregates/trading-account.aggregate';

@Injectable()
export class PortfolioLedgerService {
  constructor(private readonly publisher: EventPublisher) {}

  processFill(
    account: TradingAccountAggregate,
    openPosition: PositionAggregate | null,
    symbolId: string,
    contractSize: number,
    side: string,
    size: number,
    executedPrice: number,
    correlationId: string | null,
  ): { 
    account: TradingAccountAggregate, 
    position: PositionAggregate, 
    tradePnl: Decimal 
  } {
    const acc = this.publisher.mergeObjectContext(account);
    const qty = new Decimal(size);
    const price = new Decimal(executedPrice);
    const cSize = new Decimal(contractSize);
    
    let position: PositionAggregate;
    let tradePnl = new Decimal(0);

    if (!openPosition) {
      // First fill, no existing position
      position = PositionAggregate.create(
        this.generateId(),
        account.organizationId,
        account.workspaceId,
        account.id,
        symbolId,
        side,
        qty,
        price,
        correlationId
      );
    } else {
      position = this.publisher.mergeObjectContext(openPosition);

      if (position.side === side) {
        // Same side, increase quantity
        position.increaseQuantity(qty, price, correlationId);
      } else {
        // Opposite side, decrease quantity or reverse
        if (qty.lt(position.quantity)) {
          // Partial close
          tradePnl = position.decreaseQuantity(qty, price, cSize, correlationId);
        } else if (qty.eq(position.quantity)) {
          // Full close
          tradePnl = position.decreaseQuantity(qty, price, cSize, correlationId);
        } else {
          // Reversal
          const closingQty = position.quantity;
          const remainingQty = qty.minus(closingQty);
          
          tradePnl = position.decreaseQuantity(closingQty, price, cSize, correlationId);
          
          // The position is now closed. The orchestrator or repository will need to handle the new position.
          // For simplicity in S-16, we will open a new position with the remaining quantity.
          // This implies the handler might need to save TWO positions (one updated to CLOSED, one new OPEN).
          // We can return an array of positions if we want, but let's just re-initialize this aggregate object.
          // Wait, returning a single PositionAggregate is tricky if it splits. 
          // Let's assume the handler will persist it. 
          // If a reversal happens, we just modify the existing aggregate to become the NEW position.
          // In an Event-Driven way, closing the old one and starting a new one is cleaner.
          // To keep it simple, we will throw Error for unhandled reversals or implement it fully.
          
          throw new Error('Position reversal not fully implemented in this phase. Wait for Hedging vs Netting decision.');
        }
      }
    }

    if (!tradePnl.eq(0)) {
      acc.applyRealizedPnl(tradePnl, correlationId);
    }

    return { account: acc, position: this.publisher.mergeObjectContext(position), tradePnl };
  }

  private generateId(): string {
    return require('crypto').randomUUID();
  }
}
