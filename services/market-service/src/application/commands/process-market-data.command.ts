export class ProcessMarketDataCommand {
  constructor(
    public readonly providerId: string,
    public readonly brokerSymbol: string,
    public readonly timestamp: string, // ISO Date
    public readonly timeframe: string,
    public readonly open: number,
    public readonly high: number,
    public readonly low: number,
    public readonly close: number,
    public readonly volume: number,
    public readonly isClosed: boolean,
    public readonly actorId: string,
  ) {}
}
