export class GenerateDecisionCommand {
  constructor(
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string, // Needed for tenant verification and audit
    public readonly organizationId: string,
    public readonly strategyId: string,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly tradeDirection: 'LONG' | 'SHORT',
    public readonly requestedSize: number,
    public readonly stopLoss: number | null,
    public readonly takeProfit: number | null,
    public readonly riskScore: number,
  ) {}
}
