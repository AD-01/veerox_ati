import { Controller, Get, Param, NotFoundException, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { GetAccountParamsDto } from '../dtos/portfolio.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard, WorkspaceReadAccess, CurrentUser } from '@veerox/shared';

@Controller('api/v1/portfolio/accounts')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class PortfolioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':accountId')
  @WorkspaceReadAccess()
  async getAccount(@Param() params: GetAccountParamsDto, @CurrentUser() user: any) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: params.accountId },
      select: {
        id: true,
        workspaceId: true,
        organizationId: true,
        brokerName: true,
        accountName: true,
        currency: true,
        balance: true,
        equity: true,
        marginUsed: true,
        freeMargin: true,
        realizedPnl: true,
        unrealizedPnl: true,
      }
    });

    if (!account) {
      throw new NotFoundException(`TradingAccount ${params.accountId} not found.`);
    }

    return account;
  }

  @Get(':accountId/positions')
  @WorkspaceReadAccess()
  async getPositions(@Param() params: GetAccountParamsDto, @CurrentUser() user: any) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: params.accountId },
    });

    if (!account) {
      throw new NotFoundException(`TradingAccount ${params.accountId} not found.`);
    }

    const positions = await this.prisma.position.findMany({
      where: {
        tradingAccountId: params.accountId,
        status: 'OPEN',
      }
    });

    return { positions };
  }

  @Get(':accountId/history')
  @WorkspaceReadAccess()
  async getHistory(@Param() params: GetAccountParamsDto, @CurrentUser() user: any) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: params.accountId },
    });

    if (!account) {
      throw new NotFoundException(`TradingAccount ${params.accountId} not found.`);
    }

    const statistics = await this.prisma.accountStatistics.findMany({
      where: { accountId: params.accountId },
      orderBy: { snapshotTime: 'asc' },
    });

    const history = statistics.map(stat => ({
      timestamp: stat.snapshotTime,
      equity: stat.equity.toNumber(),
      balance: stat.balance.toNumber(),
    }));

    return { history };
  }
}
