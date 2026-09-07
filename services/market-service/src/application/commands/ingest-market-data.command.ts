export class IngestMarketDataCommand {
  constructor(
    public readonly providerId: string,
    public readonly brokerSymbol: string,
    public readonly ticks: Array<{
      timestamp: Date;
      bid: number;
      ask: number;
      volume: number;
    }>,
  ) {}
}
