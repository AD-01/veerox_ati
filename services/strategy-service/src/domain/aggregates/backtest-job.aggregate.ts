import { AggregateRoot } from '@nestjs/cqrs';

export type BacktestJobStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export class BacktestJobCreatedEvent {
  constructor(
    public readonly jobId: string,
    public readonly workspaceId: string,
    public readonly strategyId: string,
    public readonly timestamp: Date
  ) {}
}

export class BacktestJobStatusChangedEvent {
  constructor(
    public readonly jobId: string,
    public readonly oldStatus: BacktestJobStatus,
    public readonly newStatus: BacktestJobStatus,
    public readonly timestamp: Date
  ) {}
}

export class BacktestJobCompletedEvent {
  constructor(
    public readonly jobId: string,
    public readonly resultSummary: Record<string, unknown>,
    public readonly timestamp: Date
  ) {}
}

export class BacktestJobAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly strategyId: string,
    public readonly strategyVersion: string,
    public readonly symbols: string[],
    public readonly dateFrom: Date,
    public readonly dateTo: Date,
    public status: BacktestJobStatus,
    public readonly initialCapital: number,
    public readonly configuration: Record<string, unknown>,
    public readonly correlationId: string | null = null,
    public readonly spread: number | null = null,
    public readonly slippage: number | null = null,
    public readonly commission: number | null = null,
  ) {
    super();
  }

  public create(): void {
    if (this.status !== 'CREATED') {
      throw new Error('Can only initialize a CREATED job');
    }
    this.apply(
      new BacktestJobCreatedEvent(this.id, this.workspaceId, this.strategyId, new Date())
    );
  }

  public queue(): void {
    this.changeStatus('QUEUED');
  }

  public start(): void {
    if (this.status !== 'QUEUED') {
      throw new Error(`Cannot start job from status ${this.status}`);
    }
    this.changeStatus('RUNNING');
  }

  public complete(results: Record<string, unknown>): void {
    if (this.status !== 'RUNNING') {
      throw new Error(`Cannot complete job from status ${this.status}`);
    }
    this.changeStatus('COMPLETED');
    this.apply(
      new BacktestJobCompletedEvent(this.id, results, new Date())
    );
  }

  public fail(): void {
    this.changeStatus('FAILED');
  }

  private changeStatus(newStatus: BacktestJobStatus): void {
    const validTransitions: Record<BacktestJobStatus, BacktestJobStatus[]> = {
      CREATED: ['QUEUED', 'CANCELLED'],
      QUEUED: ['RUNNING', 'CANCELLED'],
      RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
      COMPLETED: [],
      FAILED: [],
      CANCELLED: [],
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    const oldStatus = this.status;
    this.status = newStatus;
    
    this.apply(
      new BacktestJobStatusChangedEvent(this.id, oldStatus, newStatus, new Date())
    );
  }
}
