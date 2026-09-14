export class SubmitManualTradeCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly actorId: string,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly tradeDirection: 'BUY' | 'SELL',
    public readonly requestedSize: number,
    public readonly orderType: string,
    public readonly stopLoss: number | null,
    public readonly takeProfit: number | null,
    public readonly clientExecutionId: string,
    public readonly authToken: string,
    public readonly requestedPrice?: number | null,
    public readonly maxDeviation?: number | null,
  ) {}
}
