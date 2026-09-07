export class CreateMarketProviderCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly config: string,
    public readonly actorId: string,
  ) {}
}
