import { AggregateRoot } from '@nestjs/cqrs';
import { ExpertAdvisorRegisteredEvent, ExpertAdvisorStatusChangedEvent } from '@veerox/events';

export type ExpertAdvisorStatus = 'DRAFT' | 'TESTING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DEPRECATED';

export class ExpertAdvisor extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly strategyId: string,
    public readonly version: string,
    public binaryUrl: string | null,
    public sourceUrl: string | null,
    public signature: string | null,
    public status: ExpertAdvisorStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super();
  }

  public register(): void {
    if (this.status !== 'DRAFT') {
      throw new Error('New Expert Advisor must be in DRAFT status');
    }
    this.apply(
      new ExpertAdvisorRegisteredEvent(this.id, this.strategyId, this.organizationId, this.version, new Date()),
    );
  }

  public validateSignature(expectedSignature: string): boolean {
    if (!this.signature) return false;
    // Mock signature validation
    return this.signature === expectedSignature;
  }

  public changeStatus(newStatus: ExpertAdvisorStatus): void {
    const validTransitions: Record<ExpertAdvisorStatus, ExpertAdvisorStatus[]> = {
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
      new ExpertAdvisorStatusChangedEvent(this.id, this.organizationId, oldStatus, newStatus, this.updatedAt),
    );
  }
}
