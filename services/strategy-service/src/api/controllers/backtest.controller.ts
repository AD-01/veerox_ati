import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RunBacktestCommand } from '../../application/handlers/run-backtest.handler';
import { PrismaService } from '@veerox/database';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    workspaceId: string;
    organizationId: string;
  };
  headers: Record<string, string | string[] | undefined>;
}

@Controller('api/v1/backtests')
@UseGuards(JwtAuthGuard)
export class BacktestController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createBacktest(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      strategyId: string;
      strategyCode: string;
      symbols: string[];
      dateFrom: string;
      dateTo: string;
      initialCapital: number;
      configuration: Record<string, unknown>;
    }
  ) {
    const workspaceId = req.user?.workspaceId;
    const userId = req.user?.id;
    const correlationId = (req.headers['x-correlation-id'] as string) || null;

    if (!workspaceId || !userId) {
      throw new Error('Unauthorized');
    }

    const command = new RunBacktestCommand(
      workspaceId,
      body.strategyId,
      body.strategyCode,
      body.symbols,
      new Date(body.dateFrom),
      new Date(body.dateTo),
      body.initialCapital,
      body.configuration,
      userId,
      (body.configuration?.['strategyVersion'] as string) || '1.0.0',
      correlationId
    );

    const result = await this.commandBus.execute(command);
    return result as Record<string, unknown>;
  }

  @Get(':id')
  async getBacktestStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new Error('Unauthorized');
    
    const job = await this.prisma.backtestJob.findUnique({
      where: { id },
      include: { results: true },
    });

    if (!job || job.workspaceId !== workspaceId) {
      throw new Error('Not found or access denied');
    }

    return job as Record<string, unknown>;
  }

  @Get(':id/trades')
  async getBacktestTrades(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Record<string, unknown>[]> {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new Error('Unauthorized');
    
    const job = await this.prisma.backtestJob.findUnique({
      where: { id },
    });

    if (!job || job.workspaceId !== workspaceId) {
      throw new Error('Not found or access denied');
    }

    const trades = await this.prisma.backtestTradeHistory.findMany({
      where: { backtestJobId: id },
      orderBy: { closedAt: 'asc' },
    });

    return trades as Record<string, unknown>[];
  }
}
