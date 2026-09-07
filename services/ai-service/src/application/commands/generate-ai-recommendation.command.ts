import { Decimal } from '@prisma/client/runtime/library';

export class GenerateAIRecommendationCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly correlationId: string,
    public readonly idempotencyKey: string,
    public readonly modelId: string,
    public readonly modelVersion: string,
    public readonly symbolId: string,
    public readonly recommendationType: string,
    public readonly confidence: Decimal,
    public readonly strategyId?: string,
    public readonly marketRegime?: string,
    public readonly suggestedSide?: string,
    public readonly suggestedSize?: Decimal,
    public readonly suggestedEntry?: Decimal,
    public readonly suggestedStopLoss?: Decimal,
    public readonly suggestedTakeProfit?: Decimal,
    public readonly reasoning?: string,
    public readonly supportingSignals?: string
  ) {}
}
