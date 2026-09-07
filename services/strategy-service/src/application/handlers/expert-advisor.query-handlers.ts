import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetExpertAdvisorByIdQuery } from '../queries/expert-advisor.queries';
import { ExpertAdvisorRepository } from '../../infrastructure/repositories/expert-advisor.repository';

@QueryHandler(GetExpertAdvisorByIdQuery)
export class GetExpertAdvisorByIdHandler implements IQueryHandler<GetExpertAdvisorByIdQuery> {
  constructor(private readonly repository: ExpertAdvisorRepository) {}

  async execute(query: GetExpertAdvisorByIdQuery): Promise<Record<string, unknown> | null> {
    const ea = await this.repository.findById(query.expertAdvisorId);

    if (!ea) {
      return null;
    }

    if (ea.organizationId !== query.organizationId) {
      throw new Error('Unauthorized: Expert Advisor belongs to a different organization');
    }

    return {
      id: ea.id,
      organizationId: ea.organizationId,
      strategyId: ea.strategyId,
      version: ea.version,
      binaryUrl: ea.binaryUrl,
      sourceUrl: ea.sourceUrl,
      signature: ea.signature,
      status: ea.status,
      createdAt: ea.createdAt,
      updatedAt: ea.updatedAt,
    };
  }
}
