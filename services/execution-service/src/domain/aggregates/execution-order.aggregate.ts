import { AggregateRoot } from '@nestjs/cqrs';
import {
  ExecutionOrderCreatedEvent,
  ExecutionOrderCompletedEvent,
  ExecutionOrderFailedEvent,
} from '@veerox/events';

export enum ExecutionOrderStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  FILLED = 'FILLED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export class ExecutionOrder extends AggregateRoot {
  private status: ExecutionOrderStatus = ExecutionOrderStatus.PENDING;
  private connectorCommandId: string | null = null;
  private executedPrice: number | null = null;
  private failureReason: string | null = null;

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

  fill(executedPrice: number): void {
    if (
      this.status !== ExecutionOrderStatus.DISPATCHED &&
      this.status !== ExecutionOrderStatus.ACKNOWLEDGED
    ) {
      throw new Error('Can only fill DISPATCHED or ACKNOWLEDGED orders');
    }
    this.status = ExecutionOrderStatus.FILLED;
    this.executedPrice = executedPrice;

    this.apply(
      new ExecutionOrderCompletedEvent(
        this.id,
        this.workspaceId,
        this.organizationId,
        this.accountId,
        this.executedPrice,
        this.connectorCommandId,
        new Date(),
      ),
    );
  }

  reject(reason: string): void {
    if (
      this.status !== ExecutionOrderStatus.DISPATCHED &&
      this.status !== ExecutionOrderStatus.ACKNOWLEDGED &&
      this.status !== ExecutionOrderStatus.PENDING
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
      ),
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
