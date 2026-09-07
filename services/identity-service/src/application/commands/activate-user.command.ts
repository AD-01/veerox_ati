export class ActivateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly actorId: string,
  ) {}
}
