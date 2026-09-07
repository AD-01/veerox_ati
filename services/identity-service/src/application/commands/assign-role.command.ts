export class AssignRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly organizationId: string | null,
    public readonly workspaceId: string | null,
    public readonly actorId: string,
  ) {}
}
