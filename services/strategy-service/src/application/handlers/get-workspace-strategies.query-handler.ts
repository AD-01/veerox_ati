import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { StrategyStatusDto } from '@veerox/contracts';
import { GetWorkspaceStrategiesQuery } from '../queries/get-workspace-strategies.query';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

@QueryHandler(GetWorkspaceStrategiesQuery)
export class GetWorkspaceStrategiesQueryHandler implements IQueryHandler<GetWorkspaceStrategiesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspaceStrategiesQuery): Promise<StrategyStatusDto[]> {
    // 1. Fetch workspace to determine organization boundary
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: query.workspaceId },
      select: { organizationId: true }
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 2. Fetch all strategies scoped to the organization
    const strategies = await this.prisma.strategy.findMany({
      where: { organizationId: workspace.organizationId },
    });

    if (strategies.length === 0) {
      return [];
    }

    // 3. Fetch current active strategy orchestration for the workspace
    const orchestration = await this.prisma.strategyOrchestration.findUnique({
      where: { workspaceId: query.workspaceId },
      select: { currentStrategyId: true, updatedAt: true }
    });

    // 4. Map to DTO
    const result: StrategyStatusDto[] = strategies.map(strategy => {
      const isCurrent = strategy.id === orchestration?.currentStrategyId;
      // If it is current, use the orchestration update time to indicate last activity, 
      // otherwise use the strategy's own update time.
      const updatedAt = isCurrent && orchestration ? orchestration.updatedAt : strategy.updatedAt;

      return {
        strategyId: strategy.id,
        name: strategy.name,
        status: strategy.status,
        isCurrent,
        updatedAt,
      };
    });

    return result;
  }
}
