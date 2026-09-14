import { AIRecommendation } from '../aggregates/ai-recommendation.aggregate';
import { DomainTransaction } from './transaction.interface';

export const AI_RECOMMENDATION_REPOSITORY = Symbol('AI_RECOMMENDATION_REPOSITORY');

export interface IAIRecommendationRepository {
  findById(id: string, tx?: DomainTransaction): Promise<AIRecommendation | null>;
  save(recommendation: AIRecommendation, tx?: DomainTransaction): Promise<void>;
}
