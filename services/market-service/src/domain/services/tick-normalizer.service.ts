import { Injectable, Logger } from '@nestjs/common';
import { RawTick } from '../../application/ports/market-provider.adapter.interface';
import { SymbolAggregate } from '../aggregates/symbol.aggregate';

export interface NormalizedTick {
  symbolId: string;
  timestamp: Date;
  bid: number;
  ask: number;
  volume: number;
}

@Injectable()
export class TickNormalizerService {
  private readonly logger = new Logger(TickNormalizerService.name);

  /**
   * Validates and normalizes a raw tick using the canonical symbol configuration.
   * Returns null if the tick is invalid or should be dropped.
   */
  normalize(rawTick: RawTick, symbolConfig: SymbolAggregate): NormalizedTick | null {
    if (!this.isValid(rawTick)) {
      return null;
    }

    const precision = symbolConfig.precision;
    
    // Normalize prices and volume to the symbol's specified precision
    const normalizedBid = this.roundToPrecision(rawTick.bid, precision);
    const normalizedAsk = this.roundToPrecision(rawTick.ask, precision);
    const normalizedVolume = this.roundToPrecision(rawTick.volume, 8); // Base volume precision

    return {
      symbolId: symbolConfig.id,
      timestamp: rawTick.timestamp,
      bid: normalizedBid,
      ask: normalizedAsk,
      volume: normalizedVolume,
    };
  }

  private isValid(tick: RawTick): boolean {
    if (tick.bid <= 0 || tick.ask <= 0) {
      this.logger.debug(`Invalid tick prices for ${tick.symbol}: bid=${tick.bid}, ask=${tick.ask}`);
      return false;
    }
    if (tick.ask < tick.bid) {
      this.logger.debug(`Negative spread for ${tick.symbol}: bid=${tick.bid}, ask=${tick.ask}`);
      return false;
    }
    
    // Drop ticks with future timestamps (allowing 1 second clock drift)
    const now = Date.now();
    if (tick.timestamp.getTime() > now + 1000) {
      this.logger.debug(`Future timestamp tick for ${tick.symbol}`);
      return false;
    }

    return true;
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}
