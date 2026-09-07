export class RestoreWorkspaceCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly actorUserId: string,
  ) {}
}
