import { AggregateRoot } from '@nestjs/cqrs';
import { StrategyRegisteredEvent, StrategyStatusChangedEvent, StrategyActivatedEvent } from '@veerox/events';

export type StrategyStatus = 'DRAFT' | 'TESTING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DEPRECATED';
export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

export class Strategy extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public name: string,
    public readonly version: string,
    public description: string | null,
    public author: string | null,
    public riskProfile: RiskProfile,
    public status: StrategyStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super();
  }

  public register(): void {
    if (this.status !== 'DRAFT') {
      throw new Error('New strategy must be in DRAFT status');
    }
    this.apply(
      new StrategyRegisteredEvent(this.id, this.organizationId, this.name, this.version, new Date()),
    );
  }

  public changeStatus(newStatus: StrategyStatus): void {
    const validTransitions: Record<StrategyStatus, StrategyStatus[]> = {
      DRAFT: ['TESTING', 'APPROVED', 'ARCHIVED'],
      TESTING: ['DRAFT', 'APPROVED', 'ARCHIVED'],
      APPROVED: ['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DEPRECATED'],
      ACTIVE: ['SUSPENDED', 'ARCHIVED', 'DEPRECATED'],
      SUSPENDED: ['ACTIVE', 'ARCHIVED', 'DEPRECATED'],
      ARCHIVED: [],
      DEPRECATED: ['ARCHIVED'],
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();

    this.apply(
      new StrategyStatusChangedEvent(this.id, this.organizationId, oldStatus, newStatus, this.updatedAt),
    );

    if (newStatus === 'ACTIVE' && oldStatus !== 'ACTIVE') {
      this.apply(new StrategyActivatedEvent(this.id, this.organizationId, this.updatedAt));
    }
  }
}
