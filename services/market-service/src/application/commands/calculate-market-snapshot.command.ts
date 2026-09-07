export class CalculateMarketSnapshotCommand {
  constructor(
    public readonly symbolId: string,
    public readonly timeframe: string,
    public readonly timestamp: Date,
    public readonly open: number,
    public readonly high: number,
    public readonly low: number,
    public readonly close: number,
    public readonly volume: number,
  ) {}
}
