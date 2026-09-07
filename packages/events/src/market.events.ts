export const MARKET_DATA_UPDATED_EVENT = 'MarketDataUpdatedEvent';
export const MARKET_INTELLIGENCE_UPDATED_EVENT = 'MarketIntelligenceUpdatedEvent';
export const MARKET_SNAPSHOT_GENERATED_EVENT = 'MarketSnapshotGeneratedEvent';

export class MarketDataUpdatedEvent {
  constructor(
    public readonly symbolId: string,
    public readonly timestamp: Date,
    public readonly timeframe: string,
    public readonly open: number,
    public readonly high: number,
    public readonly low: number,
    public readonly close: number,
    public readonly volume: number,
    public readonly isClosed: boolean,
  ) {}
}

export class MarketIntelligenceUpdatedEvent {
  constructor(
    public readonly symbolId: string,
    public readonly timestamp: Date,
    public readonly timeframe: string,
    public readonly trend: { direction: string; strength: number },
    public readonly volatility: number,
    public readonly liquidityScore: number,
    public readonly regime: string,
    public readonly confidenceScore: number,
    public readonly marketHealthScore: number,
    public readonly snapshotVersion: number,
  ) {}
}

export class MarketSnapshotGeneratedEvent {
  constructor(
    public readonly symbolId: string,
    public readonly referencePrice: number,
    public readonly contractSize: number,
    public readonly volatility: number,
    public readonly regime: string,
    public readonly timestamp: Date,
  ) {}
}
