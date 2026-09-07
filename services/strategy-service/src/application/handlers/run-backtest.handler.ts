import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { SimulationEngineService } from '../../domain/services/simulation-engine.service';
import { BacktestJobAggregate } from '../../domain/aggregates/backtest-job.aggregate';
import * as crypto from 'crypto';

export class RunBacktestCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly strategyId: string,
    public readonly strategyCode: string,
    public readonly symbols: string[],
    public readonly dateFrom: Date,
    public readonly dateTo: Date,
    public readonly initialCapital: number,
    public readonly configuration: Record<string, unknown>,
    public readonly requestedBy: string,
    public readonly strategyVersion: string,
    public readonly correlationId: string | null = null,
  ) {}
}

@Injectable()
@CommandHandler(RunBacktestCommand)
export class RunBacktestHandler implements ICommandHandler<RunBacktestCommand> {
  private readonly logger = new Logger(RunBacktestHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulationEngine: SimulationEngineService,
  ) {}

  async execute(command: RunBacktestCommand): Promise<{ jobId: string }> {
    this.logger.log(`Creating backtest job for strategy ${command.strategyId}`);

    // 1. Persist Initial Job
    const jobRecord = await this.prisma.backtestJob.create({
      data: {
        workspaceId: command.workspaceId,
        strategyId: command.strategyId,
        symbols: JSON.stringify(command.symbols),
        dateFrom: command.dateFrom,
        dateTo: command.dateTo,
        initialCapital: command.initialCapital,
        configuration: JSON.stringify(command.configuration),
        requestedBy: command.requestedBy,
        status: 'CREATED',
        strategyVersion: command.strategyVersion,
        correlationId: command.correlationId,
        spread: (command.configuration.spread as number) ?? null,
        slippage: (command.configuration.slippage as number) ?? null,
        commission: (command.configuration.commission as number) ?? null,
      },
    });

    const aggregate = new BacktestJobAggregate(
      jobRecord.id,
      jobRecord.workspaceId,
      jobRecord.strategyId,
      jobRecord.strategyVersion,
      command.symbols,
      jobRecord.dateFrom,
      jobRecord.dateTo,
      jobRecord.status as import('../../domain/aggregates/backtest-job.aggregate').BacktestJobStatus,
      jobRecord.initialCapital.toNumber(),
      command.configuration,
      jobRecord.correlationId,
      jobRecord.spread ? jobRecord.spread.toNumber() : null,
      jobRecord.slippage ? jobRecord.slippage.toNumber() : null,
      jobRecord.commission ? jobRecord.commission.toNumber() : null,
    );

    aggregate.create();
    aggregate.queue();
    await this.prisma.backtestJob.update({
      where: { id: jobRecord.id },
      data: { status: aggregate.status }
    });

    // 2. Run simulation asynchronously (fire and forget for now, normally use a queue worker like BullMQ)
    this.runSimulationAsync(aggregate, command).catch(e => {
      this.logger.error(`Simulation failed for job ${jobRecord.id}: ${e.message}`);
    });

    return { jobId: jobRecord.id };
  }

  private async runSimulationAsync(aggregate: BacktestJobAggregate, command: RunBacktestCommand) {
    try {
      const workerId = crypto.randomUUID();
      const updateResult = await this.prisma.backtestJob.updateMany({
        where: { id: aggregate.id, status: 'QUEUED' },
        data: { status: 'RUNNING', workerId }
      });

      if (updateResult.count === 0) {
        this.logger.warn(`Job ${aggregate.id} could not be claimed (already running or cancelled).`);
        return;
      }

      aggregate.start();

      const results = await this.simulationEngine.runSimulation(
        command.strategyCode,
        command.symbols,
        command.dateFrom,
        command.dateTo,
        command.initialCapital,
        command.configuration
      );

      aggregate.complete(results as unknown as Record<string, unknown>);

      // Persist results
      await this.prisma.$transaction([
        this.prisma.backtestJob.update({
          where: { id: aggregate.id },
          data: { status: aggregate.status, completedAt: new Date() }
        }),
        this.prisma.backtestResult.create({
          data: {
            backtestJobId: aggregate.id,
            totalTrades: results.totalTrades,
            winningTrades: results.winningTrades,
            losingTrades: results.losingTrades,
            winRate: results.winRate,
            netProfit: results.netProfit,
            grossProfit: results.grossProfit,
            grossLoss: results.grossLoss,
            maxDrawdown: results.maxDrawdown,
            recoveryFactor: results.recoveryFactor,
            sharpeRatio: results.sharpeRatio,
            profitFactor: results.profitFactor,
          }
        }),
        this.prisma.backtestTradeHistory.createMany({
          data: results.tradeHistory.map(t => ({
            id: t.id,
            backtestJobId: aggregate.id,
            symbol: t.symbol,
            direction: t.direction,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            stopLoss: t.stopLoss,
            takeProfit: t.takeProfit,
            lotSize: t.lotSize,
            pnl: t.pnl,
            openedAt: t.openedAt,
            closedAt: t.closedAt,
          }))
        })
      ]);

      this.logger.log(`Backtest ${aggregate.id} completed successfully.`);
    } catch (error) {
      aggregate.fail();
      await this.prisma.backtestJob.update({
        where: { id: aggregate.id },
        data: { status: aggregate.status }
      });
      throw error;
    }
  }
}
