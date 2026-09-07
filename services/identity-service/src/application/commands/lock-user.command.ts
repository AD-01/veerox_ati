export class LockUserCommand {
  constructor(
    public readonly userId: string,
    public readonly reason: string,
    public readonly actorId: string,
  ) {}
}
