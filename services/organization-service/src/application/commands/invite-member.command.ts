export class InviteMemberCommand {
  constructor(
    public readonly organizationId: string,
    public readonly email: string,
    public readonly actorId: string,
  ) {}
}
