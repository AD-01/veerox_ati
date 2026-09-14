export class WorkspaceAuthorizationService {
  /**
   * Validates if the actor has the authority to manage the given workspace.
   * - Platform Admin can manage globally.
   * - Organization Admin can manage all workspaces within their organizationId.
   * - Workspace Admin can manage their specific workspaceId.
   */
  static canManageWorkspace(
    actorUserRoles: { role: { name: string }; organizationId: string | null; workspaceId: string | null }[],
    targetOrganizationId: string,
    targetWorkspaceId: string,
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      // Platform Admin has global scope
      if (roleName === 'Platform Administrator') {
        return true;
      }
      
      // Organization Admin has scope over their specific organization
      if (roleName === 'Organization Administrator' || roleName === 'Organization Admin') {
        if (userRole.organizationId === targetOrganizationId) {
          return true;
        }
      }

      // Workspace Admin has scope over their specific workspace
      if (roleName === 'Workspace Administrator' || roleName === 'Workspace Admin') {
        if (userRole.workspaceId === targetWorkspaceId && userRole.organizationId === targetOrganizationId) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validates if the actor has the authority to read the given workspace.
   * - Platform Admin can read globally.
   * - Any member with any role tied to the organizationId or workspaceId can read it.
   */
  static canReadWorkspace(
    actorUserRoles: { role: { name: string }; organizationId: string | null; workspaceId: string | null }[],
    targetOrganizationId: string,
    targetWorkspaceId: string,
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      // Platform Admin has global scope
      if (roleName === 'Platform Administrator') {
        return true;
      }
      
      // Organization level access grants read to all workspaces in that org
      if (userRole.organizationId === targetOrganizationId && (roleName === 'Organization Administrator' || roleName === 'Organization Admin')) {
        return true;
      }

      // Workspace level access
      if (userRole.workspaceId === targetWorkspaceId && userRole.organizationId === targetOrganizationId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates if the actor has the authority to manage the given organization (e.g. create workspaces).
   * - Platform Admin can manage globally.
   * - Organization Admin can manage their specific organizationId.
   */
  static canManageOrganization(
    actorUserRoles: { role: { name: string }; organizationId: string | null; workspaceId: string | null }[],
    targetOrganizationId: string,
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      if (roleName === 'Platform Administrator') return true;
      
      if (roleName === 'Organization Administrator' || roleName === 'Organization Admin') {
        if (userRole.organizationId === targetOrganizationId) return true;
      }
    }
    return false;
  }

  /**
   * Validates if the actor has the authority to read workspaces within the given organization.
   * - Platform Admin can read globally.
   * - Any role scoped to the organizationId or any workspace within it grants some org-level read access.
   */
  static canReadOrganization(
    actorUserRoles: { role: { name: string }; organizationId: string | null; workspaceId: string | null }[],
    targetOrganizationId: string,
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      if (roleName === 'Platform Administrator') return true;
      
      if (userRole.organizationId === targetOrganizationId) return true;
      if (userRole.organizationId === targetOrganizationId && userRole.workspaceId) return true;
    }
    return false;
  }
}
