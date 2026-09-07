export class CreateSymbolCommand {
  constructor(
    public readonly providerId: string,
    public readonly brokerSymbol: string,
    public readonly standardSymbol: string,
    public readonly assetType: string,
    public readonly contractSize: number,
    public readonly tickSize: number,
    public readonly precision: number,
    public readonly actorId: string,
  ) {}
}
