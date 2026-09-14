export const ROLE_WEIGHTS: Record<string, number> = {
  'Platform Administrator': 100,
  'Organization Administrator': 90,
  'Organization Admin': 90,
  'Workspace Administrator': 80,
  'Workspace Admin': 80,
  'Workspace Editor': 50,
  'Workspace Read': 20,
};

export class RolePolicy {
  /**
   * Evaluates if an actor can mutate (modify role or remove) a target member, based on role hierarchy.
   * 
   * @param actorRoles - Roles assigned to the actor
   * @param targetRoles - Roles assigned to the target
   * @param isSelf - Whether the actor is mutating themselves
   * @param newRoleName - (Optional) The new role being assigned to the target. If omitted, implies removal.
   */
  static canMutateMember(
    actorRoles: { role: { name: string } }[],
    targetRoles: { role: { name: string } }[],
    isSelf: boolean,
    newRoleName?: string
  ): boolean {
    if (isSelf) {
      return false; // Users cannot modify/remove their own roles
    }

    const actorMaxWeight = Math.max(...actorRoles.map(ur => ROLE_WEIGHTS[ur.role.name] || 0), 0);
    const targetMaxWeight = Math.max(...targetRoles.map(ur => ROLE_WEIGHTS[ur.role.name] || 0), 0);

    const isPlatformAdmin = actorRoles.some(ur => ur.role.name === 'Platform Administrator');

    if (isPlatformAdmin) {
      return true;
    }

    // A non-platform admin cannot mutate a user with an equal or higher role
    if (targetRoles.length > 0 && actorMaxWeight <= targetMaxWeight) {
      return false;
    }

    // If a new role is being assigned, verify the actor is not assigning a role equal to or higher than their own
    if (newRoleName) {
      const newRoleWeight = ROLE_WEIGHTS[newRoleName] || 0;
      if (actorMaxWeight <= newRoleWeight) {
        return false;
      }
    }

    return true;
  }
}
