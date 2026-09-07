export class DeleteWorkspaceCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly actorUserId: string,
  ) {}
}
