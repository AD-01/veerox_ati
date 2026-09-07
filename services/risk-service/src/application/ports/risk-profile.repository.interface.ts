import { RiskProfile } from '../../domain/aggregates/risk-profile.aggregate';

export interface IRiskProfileRepository {
  findByWorkspaceId(workspaceId: string): Promise<RiskProfile | null>;
  save(riskProfile: RiskProfile): Promise<void>;
}

export const RISK_PROFILE_REPOSITORY = Symbol('RISK_PROFILE_REPOSITORY');
