import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceAuthorizationService } from './authorization.service';
import { IS_PUBLIC_KEY, WORKSPACE_MANAGE_ACCESS_KEY, WORKSPACE_READ_ACCESS_KEY } from './decorators';
import { PrismaService } from '@veerox/database';

@Injectable()
export class WorkspaceScopeGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    if (!user.userRoles) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.userId },
        include: { role: true },
      });
      user.userRoles = userRoles;
    }

    // Extract expected target workspace ID and org ID from route params ONLY (never body to prevent spoofing)
    // Avoid using req.params.id as it conflicts with entity IDs (e.g., invoices/:id)
    const targetWorkspaceId = request.params.workspaceId;
    const targetOrganizationId = request.params.organizationId || request.query.organizationId;
    
    // Set the resolved IDs on the request for downstream controllers to use
    if (targetWorkspaceId) {
      request.workspaceId = targetWorkspaceId;
    }
    if (targetOrganizationId) {
      request.organizationId = targetOrganizationId;
    }

    if (!targetWorkspaceId || !targetOrganizationId) {
      // STILL verify if the user is suspended at the organization level
      if (targetOrganizationId) {
        const orgMembership = await this.prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: targetOrganizationId, userId: user.userId } },
        });
        if (orgMembership && (orgMembership.status === 'REVOKED' || orgMembership.status === 'SUSPENDED')) {
           throw new ForbiddenException('Organization access has been suspended or revoked');
        }
      }
      return true;
    }

    // Verify workspace membership status
    const workspaceMembership = await this.prisma.workspaceMember.findUnique({
       where: { workspaceId_userId: { workspaceId: targetWorkspaceId, userId: user.userId } },
    });
    
    if (workspaceMembership && (workspaceMembership.status === 'REVOKED' || workspaceMembership.status === 'SUSPENDED')) {
       throw new ForbiddenException('Workspace access has been suspended or revoked');
    }
    
    const orgMembership = await this.prisma.organizationMember.findUnique({
       where: { organizationId_userId: { organizationId: targetOrganizationId, userId: user.userId } },
    });
    
    if (orgMembership && (orgMembership.status === 'REVOKED' || orgMembership.status === 'SUSPENDED')) {
       throw new ForbiddenException('Organization access has been suspended or revoked');
    }

    const requiresManage = this.reflector.getAllAndOverride<boolean>(WORKSPACE_MANAGE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiresRead = this.reflector.getAllAndOverride<boolean>(WORKSPACE_READ_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiresOrgManage = this.reflector.getAllAndOverride<boolean>('ORGANIZATION_MANAGE_ACCESS', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiresOrgRead = this.reflector.getAllAndOverride<boolean>('ORGANIZATION_READ_ACCESS', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!targetWorkspaceId) {
      if (!targetOrganizationId) return true; // Truly global route?

      if (requiresOrgManage) {
        const canManage = WorkspaceAuthorizationService.canManageOrganization(user.userRoles, targetOrganizationId);
        if (!canManage) throw new ForbiddenException('Insufficient organization privileges to manage workspaces');
        return true;
      }

      if (requiresOrgRead) {
        const canRead = WorkspaceAuthorizationService.canReadOrganization(user.userRoles, targetOrganizationId);
        if (!canRead) throw new ForbiddenException('Insufficient organization privileges to read workspaces');
        return true;
      }

      // If no specific org requirement but there's a workspace requirement, and workspaceId is missing:
      if (requiresManage || requiresRead) {
         throw new ForbiddenException('Workspace ID is required for this operation');
      }

      return true;
    }

    if (requiresManage) {
      const canManage = WorkspaceAuthorizationService.canManageWorkspace(user.userRoles, targetOrganizationId, targetWorkspaceId);
      if (!canManage) throw new ForbiddenException('Insufficient workspace privileges to manage');
      return true;
    }

    if (requiresRead) {
      const canRead = WorkspaceAuthorizationService.canReadWorkspace(user.userRoles, targetOrganizationId, targetWorkspaceId);
      if (!canRead) throw new ForbiddenException('Insufficient workspace privileges to read');
      return true;
    }

    return true;
  }
}
