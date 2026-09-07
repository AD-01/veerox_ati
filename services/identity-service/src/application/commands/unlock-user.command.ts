export class UnlockUserCommand {
  constructor(
    public readonly userId: string,
    public readonly actorId: string,
  ) {}
}
