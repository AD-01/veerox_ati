export class RemoveMemberCommand {
  constructor(
    public readonly organizationId: string,
    public readonly targetUserId: string,
    public readonly actorId: string,
  ) {}
}
