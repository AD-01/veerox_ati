export enum ExecutionOriginType {
  VEEROX = 'VEEROX',
  EXTERNAL_EA = 'EXTERNAL_EA',
  MANUAL = 'MANUAL',
  UNKNOWN = 'UNKNOWN',
}

export class ReconcilePortfolioCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly tradingAccountId: string,
    public readonly externalSnapshotId: string,
    public readonly snapshotTimestamp: Date,
    public readonly positions: Array<{
      symbolId: string;
      side: string;
      quantity: number;
      averageEntryPrice: number;
      brokerTicketId?: string | null;
      magicNumber?: string | null;
      origin?: ExecutionOriginType;
      // New S-21.1 Fields
      clientExecutionId?: string | null;
      brokerOrderId?: string | null;
      executedPrice?: number | null;
      realizedPnl?: number;
      commission?: number;
      swap?: number;
      executionTimestamp?: Date;
    }>,
    public readonly balance: number,
    public readonly equity: number,
    public readonly realizedPnl: number,
    public readonly freeMargin: number,
  ) {}
}
