export class UpdateProviderConfigCommand {
  constructor(
    public readonly id: string,
    public readonly config: string,
    public readonly actorId: string,
  ) {}
}
