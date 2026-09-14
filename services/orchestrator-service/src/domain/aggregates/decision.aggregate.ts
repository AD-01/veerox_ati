import { AggregateRoot } from '@nestjs/cqrs';
import { DecisionGeneratedEvent, DecisionApprovedEvent, DecisionRejectedEvent } from '@veerox/events';
import * as crypto from 'crypto';

export type DecisionOutcome = 'EXECUTE_TRADE' | 'REJECT_TRADE';
export type DecisionStatus = 'PENDING_POLICY' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface DecisionExplanation {
  primaryReason: string;
  riskImpact: number;
  marketRegime: string;
  strategyMatched: boolean;
  factors: string[];
}

export class DecisionAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string | null,
    public readonly strategyId: string | null,
    public readonly accountId: string,
    public readonly symbolId: string,
    public outcome: DecisionOutcome,
    public status: DecisionStatus,
    public confidenceScore: number,
    public explanation: DecisionExplanation,
    public readonly context: Record<string, unknown>,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super();
  }

  public static generate(
    organizationId: string,
    workspaceId: string,
    correlationId: string | null,
    strategyId: string | null,
    accountId: string,
    symbolId: string,
    outcome: DecisionOutcome,
    confidenceScore: number,
    explanation: DecisionExplanation,
    context: Record<string, unknown>
  ): DecisionAggregate {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const decision = new DecisionAggregate(
      id,
      organizationId,
      workspaceId,
      correlationId,
      strategyId,
      accountId,
      symbolId,
      outcome,
      'PENDING_POLICY',
      confidenceScore,
      explanation,
      context,
      now,
      now
    );

    decision.apply(
      new DecisionGeneratedEvent(
        id,
        correlationId || '',
        workspaceId,
        organizationId,
        outcome,
        confidenceScore,
        'PENDING_POLICY',
        JSON.stringify(explanation),
        now
      )
    );

    return decision;
  }

  public approve(): void {
    if (this.status !== 'PENDING_POLICY') {
      throw new Error('Can only approve pending decisions');
    }
    this.status = 'APPROVED';
    this.updatedAt = new Date();
    this.apply(
      new DecisionApprovedEvent(
        this.id,
        this.correlationId || '',
        this.workspaceId,
        this.outcome,
        this.updatedAt
      )
    );
  }

  public reject(reason: string): void {
    if (this.status !== 'PENDING_POLICY') {
      throw new Error('Can only reject pending decisions');
    }
    this.status = 'REJECTED';
    this.outcome = 'REJECT_TRADE';
    this.updatedAt = new Date();
    this.apply(
      new DecisionRejectedEvent(
        this.id,
        this.correlationId || '',
        this.workspaceId,
        reason,
        this.updatedAt
      )
    );
  }
}
