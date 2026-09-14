import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { MarketIntelligenceUpdatedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';
import { RequestAIInferenceCommand } from '../../commands/request-ai-inference.command';
import { v5 as uuidv5 } from 'uuid';

const NAMESPACE_AI_INFERENCE = '7ca7b810-9dad-11d1-80b4-00c04fd430c9';

@EventsHandler(MarketIntelligenceUpdatedEvent)
export class MarketIntelligenceUpdatedEventHandler implements IEventHandler<MarketIntelligenceUpdatedEvent> {
  private readonly logger = new Logger(MarketIntelligenceUpdatedEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: CommandBus,
  ) {}

  async handle(event: MarketIntelligenceUpdatedEvent) {
    this.logger.debug(`Received MarketIntelligenceUpdatedEvent for symbol ${event.symbolId}`);

    // Fetch all active AI configurations
    const activeConfigs = await this.prisma.aIConfiguration.findMany({
      where: { enabled: true },
      include: {
        workspace: {
          include: { tradingAccounts: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    for (const config of activeConfigs) {
      // 1. Throttling Check
      if (config.lastInferenceAt) {
        const timeSinceLastInferenceMs = event.timestamp.getTime() - config.lastInferenceAt.getTime();
        const requiredIntervalMs = config.inferenceIntervalMinutes * 60 * 1000;
        
        if (timeSinceLastInferenceMs < requiredIntervalMs) {
          continue; // Throttle inference
        }
      }

      // 2. Allowed Symbols Check
      if (config.allowedSymbols) {
        try {
          const symbols = JSON.parse(config.allowedSymbols);
          if (Array.isArray(symbols) && !symbols.includes(event.symbolId)) {
            continue; // Not an allowed symbol for this workspace
          }
        } catch {
          // If not valid JSON array, treat as not matching or fallback
        }
      }

      // 3. Assemble Context
      const account = config.workspace.tradingAccounts[0];
      if (!account) {
        continue; // No active trading account in workspace
      }

      const bucketMinutes = config.inferenceIntervalMinutes;
      const msPerBucket = bucketMinutes * 60 * 1000;
      const bucketStartMs = Math.floor(event.timestamp.getTime() / msPerBucket) * msPerBucket;
      const bucketId = new Date(bucketStartMs).toISOString();

      // 4. Atomic AI Inference Throttling
      const thresholdTime = new Date(event.timestamp.getTime() - msPerBucket);
      
      const updateResult = await this.prisma.aIConfiguration.updateMany({
        where: { 
          id: config.id, 
          OR: [
            { lastInferenceAt: null },
            { lastInferenceAt: { lte: thresholdTime } }
          ]
        },
        data: { lastInferenceAt: event.timestamp }
      });

      if (updateResult.count === 0) {
        // Did not acquire lock / too soon
        this.logger.debug(`Skipping inference for workspace ${config.workspaceId}: interval not elapsed or concurrent execution.`);
        continue;
      }

      // 5. Fetch Active AI Model
      const model = await this.prisma.aIModel.findFirst({
        where: { workspaceId: config.workspaceId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });

      if (!model) {
        this.logger.warn(`No active AI model found for workspace ${config.workspaceId}. Skipping inference.`);
        continue;
      }

      // 6. Dispatch Command
      const idempotencyKey = uuidv5(`${config.organizationId}-${config.workspaceId}-${config.id}-${event.symbolId}-${bucketId}`, NAMESPACE_AI_INFERENCE);
      // Generate a unique correlationId per snapshot for downstream tracing
      const correlationId = uuidv5(`${config.workspaceId}-${event.symbolId}-${event.timestamp.getTime()}`, NAMESPACE_AI_INFERENCE);
      
      const marketContext = {
        symbolId: event.symbolId,
        trend: event.trend,
        volatility: event.volatility,
        regime: event.regime,
        timestamp: event.timestamp.toISOString(),
      };

      try {
        await this.commandBus.execute(
          new RequestAIInferenceCommand(
            config.organizationId,
            config.workspaceId,
            correlationId,
            idempotencyKey,
            model.id,
            model.modelVersion,
            event.symbolId,
            'LIVE_TRADE', // recommendationType
            marketContext,
            undefined // strategyId
          )
        );
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(`Failed to request AI inference for workspace ${config.workspaceId}: ${error.message}`);
      }
    }
  }
}
