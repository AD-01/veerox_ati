export class RemoveWorkspaceMemberCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly targetUserId: string,
    public readonly actorUserId: string,
  ) {}
}
