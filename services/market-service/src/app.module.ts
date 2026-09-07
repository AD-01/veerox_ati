import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { RedisService } from '@veerox/shared/src/redis/redis.service';

import { MarketProviderController } from './api/controllers/market-provider.controller';
import { SymbolController } from './api/controllers/symbol.controller';
import { MarketDataController } from './api/controllers/market-data.controller';

import { CreateMarketProviderHandler } from './application/handlers/create-market-provider.handler';
import { UpdateProviderConfigHandler } from './application/handlers/update-provider-config.handler';
import { CreateSymbolHandler } from './application/handlers/create-symbol.handler';
import { ProcessMarketDataHandler } from './application/handlers/process-market-data.handler';
import { IngestMarketDataHandler } from './application/handlers/ingest-market-data.handler';
import { CalculateMarketSnapshotHandler } from './application/handlers/calculate-market-snapshot.handler';
import { CalculateCorrelationHandler } from './application/handlers/calculate-correlation.handler';
import { MarketDataUpdatedHandler } from './application/handlers/market-data-updated.handler';

import { MarketProviderRepository } from './infrastructure/repositories/market-provider.repository';
import { SymbolRepository } from './infrastructure/repositories/symbol.repository';
import { AuditRepository } from './infrastructure/repositories/audit.repository';
import { MarketSnapshotRepository } from './infrastructure/repositories/market-snapshot.repository';

import { MARKET_PROVIDER_REPOSITORY } from './application/ports/market-provider.repository.interface';
import { SYMBOL_REPOSITORY } from './application/ports/symbol.repository.interface';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { MARKET_PROVIDER_ADAPTER } from './application/ports/market-provider.adapter.interface';

import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { TokenService } from './infrastructure/auth/token.service';
import { MockProviderAdapter } from './infrastructure/adapters/mock-provider.adapter';
import { TickIngestionPipeline } from './infrastructure/pipeline/tick-ingestion.pipeline';
import { TickNormalizerService } from './domain/services/tick-normalizer.service';
import { CandleGeneratorService } from './domain/services/candle-generator.service';
import { IntelligenceEngineService } from './domain/services/intelligence-engine.service';
import { CorrelationEngineService } from './domain/services/correlation-engine.service';

const CommandHandlers = [
  CreateMarketProviderHandler,
  UpdateProviderConfigHandler,
  CreateSymbolHandler,
  ProcessMarketDataHandler,
  CalculateMarketSnapshotHandler,
  CalculateCorrelationHandler,
  IngestMarketDataHandler,
];

const EventHandlers = [
  MarketDataUpdatedHandler,
];

@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [MarketProviderController, SymbolController, MarketDataController],
  providers: [
    PrismaService,
    RedisService,
    JwtStrategy,
    TokenService,
    {
      provide: MARKET_PROVIDER_REPOSITORY,
      useClass: MarketProviderRepository,
    },
    {
      provide: SYMBOL_REPOSITORY,
      useClass: SymbolRepository,
    },
    {
      provide: AUDIT_REPOSITORY,
      useClass: AuditRepository,
    },
    {
      provide: MARKET_PROVIDER_ADAPTER,
      useClass: MockProviderAdapter,
    },
    TickNormalizerService,
    CandleGeneratorService,
    IntelligenceEngineService,
    CorrelationEngineService,
    TickIngestionPipeline,
    MarketSnapshotRepository,
    {
      provide: 'EVENT_PUBLISHER',
      useValue: {
        publish: async (key: string, event: unknown) => {
          console.log(`[EventPublisher] Published event to ${key}`, event);
        },
      },
    },
    ...CommandHandlers,
    ...EventHandlers,
  ],
})
export class AppModule {}
