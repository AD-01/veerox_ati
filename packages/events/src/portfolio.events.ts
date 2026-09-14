import { DomainEvent } from './index';

export class PortfolioPositionOpenedEvent extends DomainEvent {
  constructor(
    public readonly positionId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly symbolId: string,
    public readonly side: string,
    public readonly quantity: number,
    public readonly averageEntryPrice: number,
    public readonly correlationId: string | null,
    public readonly openedAt: Date,
    public readonly brokerTicketId?: string | null,
    public readonly magicNumber?: string | null,
  ) {
    super();
  }
}

export class PortfolioPositionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly positionId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly symbolId: string,
    public readonly side: string,
    public readonly quantity: number,
    public readonly averageEntryPrice: number,
    public readonly realizedPnl: number,
    public readonly correlationId: string | null,
    public readonly updatedAt: Date,
    public readonly brokerTicketId?: string | null,
    public readonly magicNumber?: string | null,
  ) {
    super();
  }
}

export class PortfolioPositionClosedEvent extends DomainEvent {
  constructor(
    public readonly positionId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly symbolId: string,
    public readonly side: string,
    public readonly realizedPnl: number,
    public readonly correlationId: string | null,
    public readonly closedAt: Date,
    public readonly brokerTicketId?: string | null,
    public readonly magicNumber?: string | null,
  ) {
    super();
  }
}

export class AccountBalanceUpdatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly balance: number,
    public readonly equity: number,
    public readonly realizedPnl: number,
    public readonly freeMargin: number,
    public readonly correlationId: string | null,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}

export class PortfolioReconciliationRequestedEvent extends DomainEvent {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly externalSnapshotId: string,
    public readonly snapshotTimestamp: Date,
    public readonly positions: any[],
    public readonly balance: number,
    public readonly equity: number,
  ) {
    super();
  }
}

export class PortfolioReconciliationCompletedEvent extends DomainEvent {
  constructor(
    public readonly snapshotId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly accountId: string,
    public readonly status: string,
    public readonly discrepancyCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class PortfolioDiscrepancyDetectedEvent extends DomainEvent {
  constructor(
    public readonly discrepancyId: string,
    public readonly snapshotId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly accountId: string,
    public readonly type: string,
    public readonly symbolId: string | null,
    public readonly internalValue: number | null,
    public readonly externalValue: number | null,
    public readonly positionId: string | null,
  ) {
    super();
  }
}
