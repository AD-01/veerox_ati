import { DomainEvent } from './index';

export class TradingAccountCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly connectorId: string,
    public readonly brokerName: string,
    public readonly accountNumber: string,
    public readonly status: string,
    public readonly createdAt: Date,
  ) {
    super();
  }
}

export class TradingAccountUpdatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly updates: Record<string, unknown>,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}

export class TradingAccountArchivedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly archivedAt: Date,
  ) {
    super();
  }
}

export class TradingAccountDeletedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly deletedAt: Date,
  ) {
    super();
  }
}

export class AccountStatisticsUpdatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly workspaceId: string,
    public readonly balance: number,
    public readonly equity: number,
    public readonly margin: number,
    public readonly freeMargin: number,
    public readonly drawdown: number,
    public readonly floatingProfit: number,
    public readonly peakEquity: number,
    public readonly snapshotTime: Date,
  ) {
    super();
  }
}

export class AccountTradingStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly workspaceId: string,
    public readonly isEnabled: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class PortfolioSynchronizedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly equity: number,
    public readonly margin: number,
    public readonly freeMargin: number,
    public readonly peakEquity: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly openPositions: any[], // Will define detailed interface if needed, or pass array of position data
    public readonly synchronizedAt: Date,
  ) {
    super();
  }
}
