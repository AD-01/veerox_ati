export class AuthorizationService {
  /**
   * Validates if the actor has the authority to manage the given organization.
   * - Platform Admin can manage globally.
   * - Organization Admin can manage within their organizationId.
   */
  static canManageOrganization(
    actorUserRoles: { role: { name: string }; organizationId: string | null }[],
    targetOrganizationId: string
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
    }

    return false;
  }

  /**
   * Validates if the actor has the authority to read the given organization.
   * - Platform Admin can read globally.
   * - Any member with any role tied to the organizationId can read it.
   */
  static canReadOrganization(
    actorUserRoles: { role: { name: string }; organizationId: string | null }[],
    targetOrganizationId: string
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      // Platform Admin has global scope
      if (roleName === 'Platform Administrator') {
        return true;
      }
      
      // Any role mapped to this organization allows read access
      if (userRole.organizationId === targetOrganizationId) {
        return true;
      }
    }

    return false;
  }
}
