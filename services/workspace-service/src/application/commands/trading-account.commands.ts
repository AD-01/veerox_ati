export class CreateTradingAccountCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly connectorId: string,
    public readonly brokerName: string,
    public readonly brokerServer: string,
    public readonly accountNumber: string,
    public readonly accountName: string,
    public readonly accountType: string,
    public readonly leverage: string,
    public readonly currency: string,
    public readonly platform: string,
    public readonly terminalVersion: string,
    public readonly actorId: string,
  ) {}
}

export class UpdateTradingAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly updates: {
      accountName?: string;
      tradingEnabled?: boolean;
    },
    public readonly actorId: string,
  ) {}
}

export class ArchiveTradingAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}

export class DeleteTradingAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}

export class UpdateAccountStatisticsCommand {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly balance: number,
    public readonly equity: number,
    public readonly margin: number,
    public readonly freeMargin: number,
    public readonly drawdown: number,
    public readonly floatingProfit: number,
    public readonly actorId: string,
  ) {}
}

export class SyncOpenPositionsCommand {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly positions: Array<{
      id: string;
      symbolId: string;
      strategyId?: string;
      status: string;
      size: number;
      direction: string;
      openPrice: number;
      currentPrice: number;
      marginUsed: number;
    }>,
    public readonly actorId: string,
  ) {}
}
