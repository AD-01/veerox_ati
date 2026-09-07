import { Injectable, Logger } from '@nestjs/common';
import { NormalizedTick } from './tick-normalizer.service';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { MarketDataUpdatedEvent } from '@veerox/events';
export interface CandleState {
  symbolId: string;
  timeframe: string;
  timestamp: Date; // Start of the candle timeframe
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
  isClosed: boolean;
}

@Injectable()
export class CandleGeneratorService {
  private readonly logger = new Logger(CandleGeneratorService.name);
  
  // In-memory cache of active (open) candles per symbol and timeframe
  // Map<SymbolId, Map<Timeframe, CandleState>>
  private activeCandles = new Map<string, Map<string, CandleState>>();

  private readonly TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Process a single tick and update all corresponding timeframes.
   */
  async processTick(tick: NormalizedTick) {
    if (!this.activeCandles.has(tick.symbolId)) {
      this.activeCandles.set(tick.symbolId, new Map());
    }
    
    const symbolCandles = this.activeCandles.get(tick.symbolId)!;
    const price = tick.bid; // Using bid price for standard candles
    
    for (const timeframe of this.TIMEFRAMES) {
      const currentCandleStart = this.getCandleStartTime(tick.timestamp, timeframe);
      let activeCandle = symbolCandles.get(timeframe);

      // Late Tick Policy: Discard ticks older than the currently open candle's boundary
      // This enforces historical candle immutability.
      if (activeCandle && currentCandleStart.getTime() < activeCandle.timestamp.getTime()) {
        this.logger.warn(`Discarded late tick for ${timeframe} candle (Tick: ${tick.timestamp.toISOString()}, Current Open: ${activeCandle.timestamp.toISOString()})`);
        continue;
      }

      // If there is an existing candle but it belongs to an older timeframe
      if (activeCandle && activeCandle.timestamp.getTime() < currentCandleStart.getTime()) {
        // Close the old candle
        activeCandle.isClosed = true;
        await this.persistAndEmit(activeCandle);
        
        // Remove from active state
        symbolCandles.delete(timeframe);
        activeCandle = undefined;
      }

      // Create new candle if none exists
      if (!activeCandle) {
        activeCandle = {
          symbolId: tick.symbolId,
          timeframe,
          timestamp: currentCandleStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: tick.volume,
          tickCount: 1,
          isClosed: false,
        };
        symbolCandles.set(timeframe, activeCandle);
      } else {
        // Update existing active candle
        activeCandle.high = Math.max(activeCandle.high, price);
        activeCandle.low = Math.min(activeCandle.low, price);
        activeCandle.close = price;
        activeCandle.volume += tick.volume;
        activeCandle.tickCount += 1;
      }
      
      // We can also emit real-time updates for the open candle here if required
      // e.g., if we want to stream M1 updates every 1 second.
    }
  }

  /**
   * Persists a closed candle and emits the MarketDataUpdatedEvent.
   */
  private async persistAndEmit(candle: CandleState) {
    try {
      await this.prisma.candle.upsert({
        where: {
          symbolId_timeframe_timestamp: {
            symbolId: candle.symbolId,
            timeframe: candle.timeframe,
            timestamp: candle.timestamp,
          }
        },
        update: {
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          tickCount: candle.tickCount,
          isClosed: candle.isClosed,
        },
        create: {
          symbolId: candle.symbolId,
          timeframe: candle.timeframe,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          tickCount: candle.tickCount,
          isClosed: candle.isClosed,
        }
      });
      
      // Emit the event strictly AFTER successful persistence
      this.eventBus.publish(
        new MarketDataUpdatedEvent(
          candle.symbolId,
          candle.timestamp,
          candle.timeframe,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
          candle.isClosed
        )
      );
      
      this.logger.debug(`Closed ${candle.timeframe} candle for ${candle.symbolId}`);
    } catch (error) {
      this.logger.error(`Failed to persist candle for ${candle.symbolId}`, error);
    }
  }

  /**
   * Calculates the start boundary of a candle for a given timeframe.
   */
  private getCandleStartTime(date: Date, timeframe: string): Date {
    const ts = new Date(date.getTime());
    ts.setMilliseconds(0);
    ts.setSeconds(0);
    
    switch (timeframe) {
      case 'M1':
        break;
      case 'M5':
        ts.setMinutes(Math.floor(ts.getMinutes() / 5) * 5);
        break;
      case 'M15':
        ts.setMinutes(Math.floor(ts.getMinutes() / 15) * 15);
        break;
      case 'M30':
        ts.setMinutes(Math.floor(ts.getMinutes() / 30) * 30);
        break;
      case 'H1':
        ts.setMinutes(0);
        break;
      case 'H4':
        ts.setMinutes(0);
        ts.setHours(Math.floor(ts.getHours() / 4) * 4);
        break;
      case 'D1':
        ts.setMinutes(0);
        ts.setHours(0);
        break;
      case 'W1':
        ts.setMinutes(0);
        ts.setHours(0);
        // Set to Monday (1)
        const day = ts.getDay();
        const diff = ts.getDate() - day + (day === 0 ? -6 : 1);
        ts.setDate(diff);
        break;
      case 'MN1':
        ts.setMinutes(0);
        ts.setHours(0);
        ts.setDate(1);
        break;
    }
    return ts;
  }
}
