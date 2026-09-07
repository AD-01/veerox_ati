export class RevokeRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly actorId: string,
  ) {}
}
