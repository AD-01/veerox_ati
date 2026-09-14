import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetWorkspaceAuditLogsQuery } from '../../application/queries/workspace.queries';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { WorkspaceReadAccess } from '@veerox/shared';
import { Request } from 'express';

interface AuthenticatedUser {
  userId: string;
}

@Controller('organizations/:orgId/workspaces')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class AuditController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/audit-logs')
  @WorkspaceReadAccess()
  async getWorkspaceAuditLogs(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') workspaceId: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetEntityId') targetEntityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query = new GetWorkspaceAuditLogsQuery(workspaceId, organizationId, {
      action,
      actorId,
      targetEntityId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return this.queryBus.execute(query);
  }
}
