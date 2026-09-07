import { Injectable, Logger } from '@nestjs/common';
import { IMarketDataProvider, RawTick } from '../../application/ports/market-provider.adapter.interface';

@Injectable()
export class MockProviderAdapter implements IMarketDataProvider {
  private readonly logger = new Logger(MockProviderAdapter.name);
  private connected = false;
  private subscribedSymbols = new Set<string>();
  private tickCallback?: (tick: RawTick) => void;
  private simulationInterval?: NodeJS.Timeout;

  async connect(): Promise<void> {
    this.connected = true;
    this.logger.log('MockProviderAdapter connected');
    this.startSimulation();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.log('MockProviderAdapter disconnected');
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
  }

  async subscribe(brokerSymbol: string): Promise<void> {
    this.subscribedSymbols.add(brokerSymbol);
    this.logger.log(`Subscribed to ${brokerSymbol}`);
  }

  async unsubscribe(brokerSymbol: string): Promise<void> {
    this.subscribedSymbols.delete(brokerSymbol);
    this.logger.log(`Unsubscribed from ${brokerSymbol}`);
  }

  onTick(callback: (tick: RawTick) => void): void {
    this.tickCallback = callback;
  }

  getHealthStatus(): { isConnected: boolean; latencyMs: number } {
    return {
      isConnected: this.connected,
      latencyMs: this.connected ? Math.random() * 50 : 0,
    };
  }

  private startSimulation() {
    this.simulationInterval = setInterval(() => {
      if (!this.connected || !this.tickCallback) return;

      this.subscribedSymbols.forEach((symbol) => {
        // Generate a synthetic tick
        const basePrice = 1000 + Math.random() * 10;
        const tick: RawTick = {
          symbol,
          bid: basePrice,
          ask: basePrice + 0.5,
          volume: Math.random() * 5,
          timestamp: new Date(),
        };
        this.tickCallback!(tick);
      });
    }, 1000); // 1 tick per second per symbol for testing
  }
}
