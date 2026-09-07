export interface CanonicalTick {
  symbolId: string;
  timestamp: Date;
  bid: number;
  ask: number;
  volume: number;
}

export interface IMarketDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(brokerSymbol: string): Promise<void>;
  unsubscribe(brokerSymbol: string): Promise<void>;
}
