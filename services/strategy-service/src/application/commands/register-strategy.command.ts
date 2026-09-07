import { RiskProfile } from '../../domain/aggregates/strategy.aggregate';

export class RegisterStrategyCommand {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly version: string,
    public readonly description: string | null,
    public readonly author: string | null,
    public readonly riskProfile: RiskProfile,
  ) {}
}
