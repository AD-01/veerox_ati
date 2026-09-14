import { AIConfiguration } from '../aggregates/ai-configuration.aggregate';
import { DomainTransaction } from './transaction.interface';

export const AI_CONFIGURATION_REPOSITORY = Symbol('AI_CONFIGURATION_REPOSITORY');

export interface IAIConfigurationRepository {
  findByWorkspaceId(workspaceId: string, tx?: DomainTransaction): Promise<AIConfiguration | null>;
  save(configuration: AIConfiguration, tx?: DomainTransaction): Promise<void>;
}
