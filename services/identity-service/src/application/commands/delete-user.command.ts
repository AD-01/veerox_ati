export class DeleteUserCommand {
  constructor(
    public readonly userId: string,
    public readonly reason: string,
    public readonly actorId: string,
  ) {}
}
