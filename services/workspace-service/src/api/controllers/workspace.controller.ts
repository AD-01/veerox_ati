import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';

import { CreateWorkspaceCommand } from '../../application/commands/create-workspace.command';
import { UpdateWorkspaceSettingsCommand } from '../../application/commands/update-workspace-settings.command';
import { ArchiveWorkspaceCommand } from '../../application/commands/archive-workspace.command';
import { RestoreWorkspaceCommand } from '../../application/commands/restore-workspace.command';
import { DeleteWorkspaceCommand } from '../../application/commands/delete-workspace.command';
import { AddWorkspaceMemberCommand } from '../../application/commands/add-workspace-member.command';
import { RemoveWorkspaceMemberCommand } from '../../application/commands/remove-workspace-member.command';
import { UpdateWorkspaceMemberRoleCommand } from '../../application/commands/update-workspace-member-role.command';
import { GetWorkspaceQuery, ListWorkspacesQuery, ListWorkspaceMembersQuery } from '../../application/queries/workspace.queries';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { 
  OrganizationManageAccess, 
  OrganizationReadAccess, 
  WorkspaceManageAccess, 
  WorkspaceReadAccess 
} from '@veerox/shared';

interface AuthenticatedUser {
  userId: string;
}

export interface CreateWorkspaceDto {
  name: string;
  initialTradingPolicies?: string;
  initialRiskLimits?: string;
  initialNotificationSettings?: string;
  initialStrategyPreferences?: string;
  automationMode?: 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';
}

export interface UpdateWorkspaceSettingsDto {
  tradingPolicies?: string;
  riskLimits?: string;
  notificationSettings?: string;
  strategyPreferences?: string;
  automationMode?: 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';
}

export interface ArchiveWorkspaceDto {
  reason?: string;
}

@Controller('organizations/:orgId/workspaces')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class WorkspaceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @OrganizationManageAccess()
  async createWorkspace(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Body() body: CreateWorkspaceDto
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new CreateWorkspaceCommand(
      organizationId,
      actorId,
      body.name,
      body.initialTradingPolicies,
      body.initialRiskLimits,
      body.initialNotificationSettings,
      body.initialStrategyPreferences,
      body.automationMode
    );
    const workspaceId = await this.commandBus.execute(command);
    return { id: workspaceId, message: 'Workspace created successfully' };
  }

  @Get()
  @OrganizationReadAccess()
  async listWorkspaces(
    @Req() req: Request,
    @Param('orgId') organizationId: string
  ) {
    const user = req.user as { userRoles?: Array<{ role: { name: string }, organizationId: string, workspaceId: string | null }> };
    let allowedWorkspaceIds: string[] | undefined = undefined;

    // Determine if the user is a Platform Admin or Org Admin for this org
    const hasGlobalRead = user.userRoles?.some(
      (ur) =>
        ur.role.name === 'Platform Administrator' ||
        (ur.organizationId === organizationId &&
          (ur.role.name === 'Organization Administrator' || ur.role.name === 'Organization Admin'))
    );

    if (!hasGlobalRead) {
      // Collect workspace IDs the user explicitly has roles for in this org
      allowedWorkspaceIds = user.userRoles
        ?.filter((ur) => ur.organizationId === organizationId && ur.workspaceId != null)
        .map((ur) => ur.workspaceId as string);
        
      if (!allowedWorkspaceIds || allowedWorkspaceIds.length === 0) {
        return []; // Return empty if no access
      }
    }

    const query = new ListWorkspacesQuery(organizationId, allowedWorkspaceIds);
    return this.queryBus.execute(query);
  }

  @Get(':id')
  @WorkspaceReadAccess()
  async getWorkspace(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string
  ) {
    const query = new GetWorkspaceQuery(id, organizationId);
    return this.queryBus.execute(query);
  }

  @Put(':id/settings')
  @WorkspaceManageAccess()
  async updateWorkspaceSettings(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceSettingsDto
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new UpdateWorkspaceSettingsCommand(
      id,
      organizationId,
      actorId,
      body
    );
    await this.commandBus.execute(command);
    return { message: 'Workspace settings updated successfully' };
  }

  @Delete(':id')
  @WorkspaceManageAccess()
  async archiveWorkspace(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new ArchiveWorkspaceCommand(
      id,
      organizationId,
      actorId
    );
    await this.commandBus.execute(command);
    return { message: 'Workspace archived successfully' };
  }

  @Post(':id/restore')
  @WorkspaceManageAccess()
  async restoreWorkspace(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new RestoreWorkspaceCommand(id, organizationId, actorId);
    await this.commandBus.execute(command);
    return { message: 'Workspace restored successfully' };
  }

  @Delete(':id/delete')
  @OrganizationManageAccess()
  async deleteWorkspace(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new DeleteWorkspaceCommand(id, organizationId, actorId);
    await this.commandBus.execute(command);
    return { message: 'Workspace deleted successfully' };
  }

  @Get(':id/members')
  @WorkspaceReadAccess()
  async listWorkspaceMembers(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string
  ) {
    const query = new ListWorkspaceMembersQuery(id, organizationId);
    return this.queryBus.execute(query);
  }

  @Post(':id/members')
  @WorkspaceManageAccess()
  async addWorkspaceMember(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { userId: string, role: string }
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new AddWorkspaceMemberCommand(id, organizationId, body.userId, body.role, actorId);
    await this.commandBus.execute(command);
    return { message: 'Workspace member added successfully' };
  }

  @Delete(':id/members/:userId')
  @WorkspaceManageAccess()
  async removeWorkspaceMember(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string,
    @Param('userId') userId: string
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new RemoveWorkspaceMemberCommand(id, organizationId, userId, actorId);
    await this.commandBus.execute(command);
    return { message: 'Workspace member removed successfully' };
  }

  @Put(':id/members/:userId')
  @WorkspaceManageAccess()
  async updateWorkspaceMemberRole(
    @Req() req: Request,
    @Param('orgId') organizationId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: string }
  ) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new UpdateWorkspaceMemberRoleCommand(id, organizationId, userId, body.role, actorId);
    await this.commandBus.execute(command);
    return { message: 'Workspace member role updated successfully' };
  }
}
