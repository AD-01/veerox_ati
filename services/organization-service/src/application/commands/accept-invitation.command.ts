export class AcceptInvitationCommand {
  constructor(
    public readonly token: string,
    public readonly actorId: string, // the user accepting it
  ) {}
}
