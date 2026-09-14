import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { WorkspaceReadAccess } from '@veerox/shared';
import { GetWorkspaceStrategiesQuery } from '../../application/queries/get-workspace-strategies.query';

@Controller('workspaces/:workspaceId/strategies/status')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class StrategyStatusController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @WorkspaceReadAccess()
  async getStrategyStatus(@Param('workspaceId') workspaceId: string) {
    const statuses = await this.queryBus.execute(new GetWorkspaceStrategiesQuery(workspaceId));
    return statuses;
  }
}
