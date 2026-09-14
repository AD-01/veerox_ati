export class RequestAIInferenceCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly idempotencyKey: string,
    public readonly modelId: string,
    public readonly modelVersion: string,
    public readonly symbolId: string,
    public readonly recommendationType: string,
    // Market data input instead of pre-computed outputs
    public readonly marketData: Record<string, unknown>,
    public readonly strategyId?: string
  ) {}
}
