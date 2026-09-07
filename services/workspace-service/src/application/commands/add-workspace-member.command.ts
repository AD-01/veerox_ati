export class AddWorkspaceMemberCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly targetUserId: string,
    public readonly role: string,
    public readonly actorUserId: string,
  ) {}
}
