import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { StrategyFactory } from '../strategies/strategy.factory';
import { StrategyOrchestrationRepository } from '../../infrastructure/repositories/strategy-orchestration.repository';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';
import { TradingOpportunityGeneratedEvent } from '@veerox/events';
import { v5 as uuidv5 } from 'uuid';
import { StrategyContext } from '../strategies/executable-strategy.interface';

const NAMESPACE_LIVE_RUNNER = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

@Injectable()
export class LiveRunnerService {
  private readonly logger = new Logger(LiveRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyFactory: StrategyFactory,
    private readonly orchestrationRepo: StrategyOrchestrationRepository,
    private readonly positionRepo: OpenPositionRepository,
  ) {}

  async processMarketDataUpdate(
    symbolId: string,
    timeframe: string,
    timestamp: Date,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    isClosed: boolean,
  ) {
    if (!isClosed) {
      // For now, we only run strategy logic on candle close
      return;
    }

    const activeOrchestrations = await this.orchestrationRepo.findActiveOrchestrations();

    for (const orchestration of activeOrchestrations) {
      if (!orchestration.currentStrategyId) continue;
      
      const workspaceId = orchestration.workspaceId;
      const strategyId = orchestration.currentStrategyId;

      await this.runStrategyForWorkspace(
        workspaceId,
        strategyId,
        orchestration.currentExpertAdvisorId,
        symbolId,
        timeframe,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      );
    }
  }

  private async runStrategyForWorkspace(
    workspaceId: string,
    strategyId: string,
    expertAdvisorId: string | null,
    symbolId: string,
    timeframe: string,
    timestamp: Date,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
  ) {
    const idempotencyKey = `${workspaceId}-${strategyId}-${symbolId}-${timeframe}-${timestamp.toISOString()}`;
    const correlationId = uuidv5(idempotencyKey, NAMESPACE_LIVE_RUNNER);

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Resolve Context
        const strategyRecord = await tx.strategy.findUnique({
          where: { id: strategyId },
        });

        if (!strategyRecord || strategyRecord.status !== 'ACTIVE') {
          return;
        }

        const account = await tx.tradingAccount.findFirst({
          where: { workspaceId, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        });

        if (!account) {
          return; // No active account
        }

        // NOTE: we use this.positionRepo inside the transaction but we pass `tx`?
        // Actually, our repository doesn't take `tx`, it uses the global Prisma client.
        // For strict correctness, we should use `tx` here to fetch positions.
        // But since positions don't change concurrently with ticks for backtesting, it's ok for now.
        // Or we just query inline:
        const openPositionRecords = await tx.openPositionReadModel.findMany({
          where: { workspaceId, symbolId, status: 'OPEN' },
        });

        const openPositions = openPositionRecords.map(r => ({
          id: r.id,
          symbol: r.symbolId,
          direction: r.direction as 'BUY' | 'SELL',
          entryPrice: r.openPrice.toNumber(),
          lotSize: r.size.toNumber(),
          pnl: 0, 
          openedAt: r.updatedAt,
        }));

        const context: StrategyContext = {
          symbol: symbolId,
          currentBalance: account.balance.toNumber(),
          currentEquity: account.equity.toNumber(),
          usedMargin: account.marginUsed.toNumber(),
          openPositions,
        };

        // 3. Execute Strategy
        const strategy = this.strategyFactory.create(strategyRecord.name); 
        
        const signal = strategy.onCandle
          ? strategy.onCandle(
              { id: 'mock', symbolId, timeframe, timestamp, open: open as any, high: high as any, low: low as any, close: close as any, volume: volume as any, tickCount: 0, isClosed: true, createdAt: new Date() },
              context
            )
          : null;

        // 4. Handle Signal & Atomically Persist Outbox
        if (signal) {
          this.logger.log(`Strategy ${strategyId} generated ${signal.action} ${signal.direction} signal for ${symbolId}`);
          
          if (signal.action === 'OPEN') {
            const mappedDirection = signal.direction === 'BUY' ? 'LONG' : 'SHORT';
            
            const event = new TradingOpportunityGeneratedEvent(
              correlationId,
              workspaceId,
              strategyRecord.organizationId,
              strategyId,
              expertAdvisorId,
              account.id,
              symbolId,
              mappedDirection,
              signal.lotSize,
              signal.stopLoss || null,
              signal.takeProfit || null,
              new Date(),
            );

            await tx.outboxMessage.create({
              data: {
                aggregateType: 'LiveRunner',
                aggregateId: strategyId,
                eventType: 'TradingOpportunityGeneratedEvent',
                payload: JSON.parse(JSON.stringify(event)),
                organizationId: strategyRecord.organizationId,
                workspaceId,
                correlationId,
                idempotencyKey,
              },
            });
          }
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        this.logger.debug(`Idempotent execution: duplicate signal for ${idempotencyKey} was ignored.`);
        return;
      }
      this.logger.error(`Failed to execute strategy ${strategyId} for tick ${timestamp}: ${error.message}`);
      throw error;
    }
  }
}

