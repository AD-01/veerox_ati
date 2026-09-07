import { MarketIntelligenceSnapshot } from '../../domain/aggregates/strategy-orchestration.aggregate';

export class EvaluateStrategyCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly snapshotId: string,
    public readonly intelligence: MarketIntelligenceSnapshot,
    public readonly actorId: string,
  ) {}
}
