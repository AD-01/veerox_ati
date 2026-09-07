import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { GetRiskAssessmentsQuery } from '../../queries/risk-assessment/get-risk-assessments.query';

@QueryHandler(GetRiskAssessmentsQuery)
export class GetRiskAssessmentsQueryHandler implements IQueryHandler<GetRiskAssessmentsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetRiskAssessmentsQuery): Promise<unknown[]> {
    // Requires both organizationId and workspaceId for tenant isolation
    const assessments = await this.prisma.riskAssessment.findMany({
      where: {
        workspaceId: query.workspaceId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: query.limit,
      skip: query.offset,
    });

    return assessments;
  }
}
