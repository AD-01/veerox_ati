import * as crypto from 'crypto';

export interface TrendInfo {
  direction: string;
  strength: number;
}

export interface MarketSnapshotProps {
  id: string;
  symbolId: string;
  timeframe: string;
  timestamp: Date;
  referencePrice: number;
  trendDirection: string;
  trendStrength: number;
  volatility: number;
  liquidityScore: number;
  regime: string;
  confidenceScore: number;
  marketHealthScore: number;
  snapshotVersion: number;
  createdAt: Date;
}

export class MarketSnapshot {
  private constructor(private readonly props: MarketSnapshotProps) {
    this.validate();
  }

  static create(props: Omit<MarketSnapshotProps, 'id' | 'createdAt' | 'snapshotVersion'>): MarketSnapshot {
    return new MarketSnapshot({
      ...props,
      id: crypto.randomUUID(),
      snapshotVersion: 1,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: MarketSnapshotProps): MarketSnapshot {
    return new MarketSnapshot(props);
  }

  private validate(): void {
    if (this.props.trendStrength < 0 || this.props.trendStrength > 100) {
      throw new Error('Trend strength must be between 0 and 100');
    }
    if (this.props.liquidityScore < 0 || this.props.liquidityScore > 100) {
      throw new Error('Liquidity score must be between 0 and 100');
    }
    if (this.props.confidenceScore < 0 || this.props.confidenceScore > 100) {
      throw new Error('Confidence score must be between 0 and 100');
    }
    if (this.props.marketHealthScore < 0 || this.props.marketHealthScore > 100) {
      throw new Error('Market health score must be between 0 and 100');
    }
    if (this.props.volatility < 0) {
      throw new Error('Volatility cannot be negative');
    }
    const validRegimes = ['Trending', 'Ranging', 'Breakout', 'High Volatility', 'Low Volatility', 'Recovery', 'Uncertain'];
    if (!validRegimes.includes(this.props.regime)) {
      throw new Error(`Invalid market regime: ${this.props.regime}`);
    }
    const validTrends = ['UP', 'DOWN', 'FLAT'];
    if (!validTrends.includes(this.props.trendDirection)) {
      throw new Error(`Invalid trend direction: ${this.props.trendDirection}`);
    }
  }

  get id(): string { return this.props.id; }
  get symbolId(): string { return this.props.symbolId; }
  get timeframe(): string { return this.props.timeframe; }
  get timestamp(): Date { return this.props.timestamp; }
  get referencePrice(): number { return this.props.referencePrice; }
  get trendDirection(): string { return this.props.trendDirection; }
  get trendStrength(): number { return this.props.trendStrength; }
  get volatility(): number { return this.props.volatility; }
  get liquidityScore(): number { return this.props.liquidityScore; }
  get regime(): string { return this.props.regime; }
  get confidenceScore(): number { return this.props.confidenceScore; }
  get marketHealthScore(): number { return this.props.marketHealthScore; }
  get snapshotVersion(): number { return this.props.snapshotVersion; }
  get createdAt(): Date { return this.props.createdAt; }
}
