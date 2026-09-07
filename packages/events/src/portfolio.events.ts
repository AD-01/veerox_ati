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
