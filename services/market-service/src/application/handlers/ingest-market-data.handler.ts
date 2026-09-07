import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { IngestMarketDataCommand } from '../commands/ingest-market-data.command';
import { PrismaService } from '@veerox/database';
import { TickNormalizerService } from '../../domain/services/tick-normalizer.service';
import { CandleGeneratorService } from '../../domain/services/candle-generator.service';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';
import { RawTick } from '../ports/market-provider.adapter.interface';
import * as crypto from 'crypto';

@Injectable()
@CommandHandler(IngestMarketDataCommand)
export class IngestMarketDataHandler implements ICommandHandler<IngestMarketDataCommand> {
  private readonly logger = new Logger(IngestMarketDataHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tickNormalizer: TickNormalizerService,
    private readonly candleGenerator: CandleGeneratorService,
  ) {}

  async execute(command: IngestMarketDataCommand): Promise<void> {
    this.logger.log(`Ingesting ${command.ticks.length} ticks for ${command.providerId} / ${command.brokerSymbol}`);

    // Fetch Symbol config for normalization (Precision, standardSymbol)
    const symbolData = await this.prisma.symbol.findUnique({
      where: {
        providerId_brokerSymbol: {
          providerId: command.providerId,
          brokerSymbol: command.brokerSymbol,
        },
      },
    });

    if (!symbolData) {
      this.logger.warn(`Symbol not found for provider ${command.providerId} and broker symbol ${command.brokerSymbol}`);
      return;
    }

    const symbolConfig = SymbolAggregate.reconstitute({
      id: symbolData.id,
      providerId: symbolData.providerId,
      brokerSymbol: symbolData.brokerSymbol,
      standardSymbol: symbolData.standardSymbol,
      assetType: symbolData.assetType as string,
      contractSize: symbolData.contractSize.toNumber(),
      tickSize: symbolData.tickSize.toNumber(),
      precision: symbolData.precision,
      status: symbolData.status as string,
      createdAt: symbolData.createdAt,
      updatedAt: symbolData.updatedAt
    });

    const validTicksToInsert = [];

    const processedTickHashes = new Set<string>();

    for (const rawTick of command.ticks) {
      const rt: RawTick = {
        symbol: command.brokerSymbol,
        timestamp: rawTick.timestamp,
        bid: rawTick.bid,
        ask: rawTick.ask,
        volume: rawTick.volume,
      };

      const normalizedTick = this.tickNormalizer.normalize(rt, symbolConfig);
      
      if (normalizedTick) {
        // Create a deterministic hash to prevent double-counting in memory
        const hashPayload = `${normalizedTick.symbolId}-${normalizedTick.timestamp.getTime()}-${normalizedTick.bid}-${normalizedTick.ask}-${normalizedTick.volume}`;
        const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
        
        if (!processedTickHashes.has(hash)) {
          processedTickHashes.add(hash);
          validTicksToInsert.push({
            id: hash.substring(0, 32), // Use hash as deterministic ID (fallback length)
            ...normalizedTick
          });
          
          // Feed into Candle Generator
          await this.candleGenerator.processTick(normalizedTick);
        }
      }
    }

    if (validTicksToInsert.length === 0) {
      return;
    }

    // Persist ticks using createMany with skipDuplicates for robustness against partial batch overlap
    try {
      await this.prisma.tick.createMany({
        data: validTicksToInsert.map(t => ({
          id: t.id,
          symbolId: t.symbolId,
          timestamp: t.timestamp,
          bid: t.bid,
          ask: t.ask,
          volume: t.volume,
        })),
        skipDuplicates: true,
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Failed to bulk insert ticks: ${errorMsg}`);
      throw e; // Do not swallow, fail the command so DLQ can catch it
    }
  }
}
