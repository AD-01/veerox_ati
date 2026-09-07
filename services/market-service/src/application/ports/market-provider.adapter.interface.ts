export interface RawTick {
  symbol: string;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
}

export const MARKET_PROVIDER_ADAPTER = 'MARKET_PROVIDER_ADAPTER';

export interface IMarketDataProvider {
  /**
   * Initialize connection with the external provider.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the external provider.
   */
  disconnect(): Promise<void>;

  /**
   * Subscribe to real-time market data for a given broker symbol.
   */
  subscribe(brokerSymbol: string): Promise<void>;

  /**
   * Unsubscribe from market data for a given broker symbol.
   */
  unsubscribe(brokerSymbol: string): Promise<void>;

  /**
   * Attach a listener for incoming raw ticks.
   */
  onTick(callback: (tick: RawTick) => void): void;

  /**
   * Check the connection health of the provider.
   */
  getHealthStatus(): { isConnected: boolean; latencyMs: number };
}
