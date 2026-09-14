import { AIModel } from '../aggregates/ai-model.aggregate';
import { DomainTransaction } from './transaction.interface';

export const AI_MODEL_REPOSITORY = Symbol('AI_MODEL_REPOSITORY');

export interface IAIModelRepository {
  findById(id: string, tx?: DomainTransaction): Promise<AIModel | null>;
  save(model: AIModel, tx?: DomainTransaction): Promise<void>;
}
