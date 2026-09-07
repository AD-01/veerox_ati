import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { GetAccountParamsDto } from '../dtos/portfolio.dto';

// In a real implementation, we would use a @WorkspaceMemberGuard and extract workspaceId/organizationId from req.user
// For S-16, we focus on the REST implementation.
@Controller('api/v1/portfolio/accounts')
export class PortfolioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':accountId')
  async getAccount(@Param() params: GetAccountParamsDto) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: params.accountId },
      select: {
        id: true,
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
  async getPositions(@Param() params: GetAccountParamsDto) {
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
}
