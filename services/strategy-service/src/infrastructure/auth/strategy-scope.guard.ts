import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class StrategyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }

    // Extract target organizationId from params or body
    const targetOrganizationId = request.params.organizationId || request.body.organizationId;

    if (!targetOrganizationId) {
      throw new ForbiddenException('Organization ID context is missing from request');
    }

    const roles = user.roles || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasAccess = roles.some((r: any) => r.organizationId === targetOrganizationId);

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this organization');
    }

    return true;
  }
}
