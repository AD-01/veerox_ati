export class EvaluateRiskCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly strategyId: string | undefined,
    public readonly tradeDirection: 'LONG' | 'SHORT',
    public readonly requestedSize: number,
    public readonly actorId: string,
    public readonly correlationId?: string,
    public readonly stopLoss?: number,
    public readonly takeProfit?: number,
  ) {}
}
