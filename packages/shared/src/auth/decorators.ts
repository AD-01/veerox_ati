import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const WORKSPACE_MANAGE_ACCESS_KEY = 'WORKSPACE_MANAGE_ACCESS';
export const WorkspaceManageAccess = () => SetMetadata(WORKSPACE_MANAGE_ACCESS_KEY, true);

export const WORKSPACE_READ_ACCESS_KEY = 'WORKSPACE_READ_ACCESS';
export const WorkspaceReadAccess = () => SetMetadata(WORKSPACE_READ_ACCESS_KEY, true);

export const ORGANIZATION_MANAGE_ACCESS_KEY = 'ORGANIZATION_MANAGE_ACCESS';
export const OrganizationManageAccess = () => SetMetadata(ORGANIZATION_MANAGE_ACCESS_KEY, true);

export const ORGANIZATION_READ_ACCESS_KEY = 'ORGANIZATION_READ_ACCESS';
export const OrganizationReadAccess = () => SetMetadata(ORGANIZATION_READ_ACCESS_KEY, true);
