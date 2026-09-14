export interface EventEnvelope<T = unknown> {
  id: string;
  name: string;
  version: number;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  data: T;
}

export abstract class DomainEvent {
  public readonly occurredOn: Date;
  constructor() {
    this.occurredOn = new Date();
  }
}

export * from './identity.events';
export * from './organization.events';
export * from './workspace.events';
export * from './connector.events';
export * from './trading-account.events';
export * from './market.events';
export * from './strategy.events';
export * from './execution.events';
export * from './risk.events';
export * from './decision.events';
export * from './policy.events';
export * from './portfolio.events';
export * from './commercial.events';
export * from './ai.events';
export * from './signal.events';