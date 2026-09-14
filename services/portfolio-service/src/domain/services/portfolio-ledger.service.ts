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
    portfolioMode: string = 'NETTING',
    brokerTicketId: string | null = null,
    magicNumber: string | null = null,
  ): { 
    account: TradingAccountAggregate, 
    positions: PositionAggregate[], 
    tradePnl: Decimal 
  } {
    const acc = this.publisher.mergeObjectContext(account);
    const qty = new Decimal(size);
    const price = new Decimal(executedPrice);
    const cSize = new Decimal(contractSize);
    
    const positionsToSave: PositionAggregate[] = [];
    let tradePnl = new Decimal(0);

    const isNewHedge = portfolioMode === 'HEDGING' && openPosition && openPosition.side === side;
    if (!openPosition || isNewHedge) {
      // First fill, no existing position, or HEDGING mode new independent ticket
      const newPos = PositionAggregate.create(
        this.generateId(),
        account.organizationId,
        account.workspaceId,
        account.id,
        symbolId,
        side,
        qty,
        price,
        correlationId,
        brokerTicketId,
        magicNumber
      );
      positionsToSave.push(this.publisher.mergeObjectContext(newPos));
    } else {
      const position = this.publisher.mergeObjectContext(openPosition);

      if (position.side === side) {
        // Same side, increase quantity
        position.increaseQuantity(qty, price, correlationId);
        positionsToSave.push(position);
      } else {
        // Opposite side, decrease quantity or reverse
        if (qty.lt(position.quantity)) {
          // Partial close
          tradePnl = position.decreaseQuantity(qty, price, cSize, correlationId);
          positionsToSave.push(position);
        } else if (qty.eq(position.quantity)) {
          // Full close
          tradePnl = position.decreaseQuantity(qty, price, cSize, correlationId);
          positionsToSave.push(position);
        } else {
          // Reversal
          const closingQty = position.quantity;
          const remainingQty = qty.minus(closingQty);
          
          tradePnl = position.decreaseQuantity(closingQty, price, cSize, correlationId);
          positionsToSave.push(position);
          
          // Open a new position with the remainder
          const reversedPos = PositionAggregate.create(
            this.generateId(),
            account.organizationId,
            account.workspaceId,
            account.id,
            symbolId,
            side,
            remainingQty,
            price,
            correlationId,
            brokerTicketId,
            magicNumber
          );
          positionsToSave.push(this.publisher.mergeObjectContext(reversedPos));
        }
      }
    }

    if (!tradePnl.eq(0)) {
      acc.applyRealizedPnl(tradePnl, correlationId);
    }

    return { account: acc, positions: positionsToSave, tradePnl };
  }

  private generateId(): string {
    return require('crypto').randomUUID();
  }
}
