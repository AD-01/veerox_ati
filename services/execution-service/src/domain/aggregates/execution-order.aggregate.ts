import { AggregateRoot } from '@nestjs/cqrs';
import {
  ExecutionOrderCreatedEvent,
  ExecutionOrderCompletedEvent,
  ExecutionOrderFailedEvent,
  ExecutionOrderPartiallyFilledEvent,
  ExecutionOrderUncertainEvent,
} from '@veerox/events';

export enum ExecutionOrderStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  AWAITING_RECONCILIATION = 'AWAITING_RECONCILIATION',
}

export class ExecutionOrder extends AggregateRoot {
  private status: ExecutionOrderStatus = ExecutionOrderStatus.PENDING;
  private connectorCommandId: string | null = null;
  private executedPrice: number | null = null;
  private failureReason: string | null = null;
  
  public executedSize: number = 0;
  public remainingSize: number;
  public brokerOrderId: string | null = null;
  public brokerTicketId: string | null = null;
  public magicNumber: string | null = null;

  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly decisionId: string | null,
    public readonly correlationId: string | null,
    public readonly orderType: string,
    public readonly side: string,
    public readonly size: number,
    public readonly requestedPrice: number | null,
    public readonly stopLoss: number | null,
    public readonly takeProfit: number | null,
  ) {
    super();
    this.remainingSize = size;
  }

  create(): void {
    if (this.status !== ExecutionOrderStatus.PENDING) {
      throw new Error('Order can only be created in PENDING state');
    }
    this.apply(
      new ExecutionOrderCreatedEvent(
        this.id,
        this.workspaceId,
        this.organizationId,
        this.accountId,
        this.symbolId,
        this.decisionId,
        this.correlationId,
        this.orderType,
        this.side,
        this.size,
        this.requestedPrice,
        this.stopLoss,
        this.takeProfit,
        new Date(),
      ),
    );
  }

  dispatch(connectorCommandId: string): void {
    if (this.status !== ExecutionOrderStatus.PENDING) {
      throw new Error('Can only dispatch PENDING orders');
    }
    this.status = ExecutionOrderStatus.DISPATCHED;
    this.connectorCommandId = connectorCommandId;
  }

  acknowledge(): void {
    if (this.status !== ExecutionOrderStatus.DISPATCHED) {
      throw new Error('Can only acknowledge DISPATCHED orders');
    }
    this.status = ExecutionOrderStatus.ACKNOWLEDGED;
  }

  fill(executedPrice: number, executedSize: number = this.remainingSize, brokerOrderId?: string, brokerTicketId?: string, commission?: number, swap?: number, realizedPnl?: number): void {
    if (
      this.status !== ExecutionOrderStatus.DISPATCHED &&
      this.status !== ExecutionOrderStatus.ACKNOWLEDGED &&
      this.status !== ExecutionOrderStatus.PARTIALLY_FILLED
    ) {
      throw new Error('Can only fill DISPATCHED, ACKNOWLEDGED, or PARTIALLY_FILLED orders');
    }
    
    this.executedPrice = executedPrice;
    this.executedSize += executedSize;
    this.remainingSize -= executedSize;
    
    if (brokerOrderId) this.brokerOrderId = brokerOrderId;
    if (brokerTicketId) this.brokerTicketId = brokerTicketId;

    if (this.remainingSize <= 0) {
      this.status = ExecutionOrderStatus.FILLED;
      this.apply(
        new ExecutionOrderCompletedEvent(
          this.id,
          this.workspaceId,
          this.organizationId,
          this.accountId,
          this.executedPrice,
          this.connectorCommandId,
          new Date(),
          this.symbolId,
          this.side,
          this.size,
          this.correlationId,
          this.brokerOrderId,
          this.brokerTicketId,
          this.magicNumber,
          this.executedSize,
          commission,
          swap,
          realizedPnl
        ),
      );
    } else {
      this.status = ExecutionOrderStatus.PARTIALLY_FILLED;
      this.apply(
        new ExecutionOrderPartiallyFilledEvent(
          this.id,
          this.workspaceId,
          this.organizationId,
          this.accountId,
          this.executedPrice,
          executedSize,
          this.remainingSize,
          this.connectorCommandId,
          new Date(),
          this.brokerOrderId,
          this.brokerTicketId,
          this.magicNumber,
          this.symbolId,
          this.side,
          this.correlationId,
          commission,
          swap,
          realizedPnl
        ),
      );
    }
  }

  reject(reason: string): void {
    if (
      this.status !== ExecutionOrderStatus.DISPATCHED &&
      this.status !== ExecutionOrderStatus.ACKNOWLEDGED &&
      this.status !== ExecutionOrderStatus.PENDING &&
      this.status !== ExecutionOrderStatus.PARTIALLY_FILLED
    ) {
      throw new Error('Cannot reject order in current state');
    }
    this.status = ExecutionOrderStatus.REJECTED;
    this.failureReason = reason;

    this.apply(
      new ExecutionOrderFailedEvent(
        this.id,
        this.workspaceId,
        this.organizationId,
        this.accountId,
        this.failureReason,
        this.connectorCommandId,
        new Date(),
      ),
    );
  }

  fail(reason: string): void {
    if (this.status === ExecutionOrderStatus.FILLED) {
      throw new Error('Cannot fail a FILLED order');
    }
    this.status = ExecutionOrderStatus.FAILED;
    this.failureReason = reason;

    this.apply(
      new ExecutionOrderFailedEvent(
        this.id,
        this.workspaceId,
        this.organizationId,
        this.accountId,
        this.failureReason,
        this.connectorCommandId,
        new Date(),
        this.symbolId,
        this.side,
        this.size,
        this.correlationId,
        this.brokerOrderId,
        this.brokerTicketId,
        this.magicNumber
      ),
    );
  }

  markUncertain(reason: string): void {
    if (this.status === ExecutionOrderStatus.FILLED || this.status === ExecutionOrderStatus.FAILED || this.status === ExecutionOrderStatus.REJECTED) {
      throw new Error('Cannot mark terminal order as uncertain');
    }
    this.status = ExecutionOrderStatus.AWAITING_RECONCILIATION;
    this.failureReason = reason;

    // Dispatch the new Uncertain event
    this.apply(
      new ExecutionOrderUncertainEvent(
        this.id,
        this.workspaceId,
        this.organizationId,
        this.accountId,
        this.failureReason,
        this.connectorCommandId,
        new Date(),
        this.symbolId,
        this.side,
        this.size,
        this.correlationId
      )
    );
  }

  getStatus(): ExecutionOrderStatus {
    return this.status;
  }

  getConnectorCommandId(): string | null {
    return this.connectorCommandId;
  }

  getExecutedPrice(): number | null {
    return this.executedPrice;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }
}
