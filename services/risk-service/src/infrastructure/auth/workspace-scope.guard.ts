import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class WorkspaceScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }

    // Extract target workspaceId from params, body, or query
    const targetWorkspaceId = request.params.workspaceId || request.body.workspaceId || request.query.workspaceId;

    if (!targetWorkspaceId) {
      throw new ForbiddenException('Workspace ID context is missing from request');
    }

    const roles = user.roles || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasAccess = roles.some((r: any) => r.workspaceId === targetWorkspaceId);

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this workspace');
    }

    return true;
  }
}
