export const ROLE_WEIGHTS: Record<string, number> = {
  'Platform Administrator': 10,
  'Organization Administrator': 20,
  'Workspace Administrator': 30,
  'Trader': 40,
  'Developer': 50,
  'Support Engineer': 60,
  'Viewer': 70,
};

export class AuthorizationService {
  /**
   * Validates if the actor has the authority to assign or revoke the target role.
   * Actor must have strictly greater authority (lower weight) than the target role.
   * Equal or lower authority (higher weight) is denied.
   */
  static validateRoleHierarchy(actorRoles: string[], targetRole: string): boolean {
    const actorHighestWeight = this.getHighestAuthorityWeight(actorRoles);
    const targetWeight = ROLE_WEIGHTS[targetRole] || 100; // Unknown roles get lowest authority

    // Actor must have strictly greater authority (lower weight) than the target role
    return actorHighestWeight < targetWeight;
  }

  /**
   * Validates if the actor has the authority to assign roles within the requested scope.
   * - Platform Admin can assign globally.
   * - Org Admin can assign roles within their organizationId.
   * - Workspace Admin can assign roles within their workspaceId.
   */
  static validateScope(
    actorUserRoles: { role: { name: string }; organizationId: string | null; workspaceId: string | null }[],
    targetOrganizationId: string | null,
    targetWorkspaceId: string | null
  ): boolean {
    for (const userRole of actorUserRoles) {
      const roleName = userRole.role.name;
      
      // Platform Admin has global scope
      if (roleName === 'Platform Administrator') {
        return true;
      }
      
      // Organization Admin has scope over their specific organization and any workspace within it
      if (roleName === 'Organization Administrator') {
        if (targetOrganizationId && userRole.organizationId === targetOrganizationId) {
          return true;
        }
      }
      
      // Workspace Admin has scope over their specific workspace
      if (roleName === 'Workspace Administrator') {
        if (targetWorkspaceId && userRole.workspaceId === targetWorkspaceId) {
          return true;
        }
      }
    }

    return false;
  }

  private static getHighestAuthorityWeight(roles: string[]): number {
    let minWeight = 100; // Default to lowest authority
    for (const role of roles) {
      const weight = ROLE_WEIGHTS[role];
      if (weight !== undefined && weight < minWeight) {
        minWeight = weight;
      }
    }
    return minWeight;
  }
}
