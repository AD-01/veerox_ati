import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceAuthorizationService } from '../../domain/services/authorization.service';
import { IS_PUBLIC_KEY, WORKSPACE_MANAGE_ACCESS_KEY, WORKSPACE_READ_ACCESS_KEY } from './decorators';

@Injectable()
export class WorkspaceScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.userRoles) {
      throw new ForbiddenException('User context missing roles mapping');
    }

    // Extract expected target workspace ID and org ID from route params or body
    const targetWorkspaceId = request.params.id || request.body.workspaceId;
    const targetOrganizationId = request.params.orgId || request.body.organizationId || request.query.organizationId;
    
    if (!targetWorkspaceId || !targetOrganizationId) {
      // If the route doesn't specify a workspace context, we let it pass if it's a create/list route,
      // but those will have their own organization scope validation.
      return true;
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
