import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, OnApplicationShutdown } from '@nestjs/common';
import { Subject, Subscription, bufferTime, filter, map } from 'rxjs';
import { PrismaService } from '@veerox/database';
import { IMarketDataProvider, MARKET_PROVIDER_ADAPTER, RawTick } from '../../application/ports/market-provider.adapter.interface';
import { TickNormalizerService, NormalizedTick } from '../../domain/services/tick-normalizer.service';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';
import { ISymbolRepository } from '../../application/ports/symbol.repository.interface';
import { SYMBOL_REPOSITORY } from '../../application/ports/symbol.repository.interface';
import { CandleGeneratorService } from '../../domain/services/candle-generator.service';

@Injectable()
export class TickIngestionPipeline implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(TickIngestionPipeline.name);
  private rawTickSubject = new Subject<RawTick>();
  private subscription?: Subscription;
  
  // Cache of brokerSymbol -> SymbolAggregate
  private symbolCache = new Map<string, SymbolAggregate>();

  constructor(
    @Inject(MARKET_PROVIDER_ADAPTER) private readonly provider: IMarketDataProvider,
    @Inject(SYMBOL_REPOSITORY) private readonly symbolRepository: ISymbolRepository,
    private readonly normalizer: TickNormalizerService,
    private readonly candleGenerator: CandleGeneratorService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Tick Ingestion Pipeline...');
    
    // Setup RxJS stream for high-throughput tick processing
    this.subscription = this.rawTickSubject.pipe(
      // 1. Enrich & Normalize
      map((rawTick) => {
        const symbolConfig = this.symbolCache.get(rawTick.symbol);
        if (!symbolConfig) return null;
        return this.normalizer.normalize(rawTick, symbolConfig);
      }),
      // 2. Filter out invalid ticks
      filter((tick): tick is NormalizedTick => tick !== null),
      // 3. Batch them (e.g. 1 second or max 1000 items)
      bufferTime(1000, undefined, 1000)
    ).subscribe({
      next: (batch) => this.processBatch(batch),
      error: (err) => this.logger.error('Error in tick pipeline', err),
    });

    // Wire provider callback
    this.provider.onTick((tick) => this.rawTickSubject.next(tick));
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down Tick Ingestion Pipeline...');
    // In a real scenario, we might wait for the current batch to finish
    // Since processBatch is async, we can introduce a flag or await active promises
    this.subscription?.unsubscribe();
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  async loadSymbolCache(providerId: string) {
    this.logger.log(`Loading symbols for provider ${providerId}`);
  }

  async getOrCacheSymbol(providerId: string, brokerSymbol: string): Promise<SymbolAggregate | null> {
    if (this.symbolCache.has(brokerSymbol)) {
      return this.symbolCache.get(brokerSymbol)!;
    }
    const symbol = await this.symbolRepository.findByBrokerSymbol(providerId, brokerSymbol);
    if (symbol) {
      this.symbolCache.set(brokerSymbol, symbol);
    }
    return symbol;
  }

  private async processBatch(batch: NormalizedTick[]) {
    if (batch.length === 0) return;

    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt <= maxRetries) {
      try {
        await this.prisma.tick.createMany({
          data: batch.map(t => ({
            symbolId: t.symbolId,
            timestamp: t.timestamp,
            bid: t.bid,
            ask: t.ask,
            volume: t.volume,
          })),
        });

        this.logger.debug(`Persisted batch of ${batch.length} ticks`);

        for (const tick of batch) {
          await this.candleGenerator.processTick(tick);
        }
        return; // Success
      } catch (error) {
        attempt++;
        this.logger.warn(`Failed to process tick batch (attempt ${attempt}/${maxRetries + 1})`, error);
        
        if (attempt > maxRetries) {
          this.logger.error(`Critical Failure: Dropping batch of ${batch.length} ticks after ${maxRetries} retries`, error);
          // In a production system we'd write to a durable DLQ file here
          return;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }
}
