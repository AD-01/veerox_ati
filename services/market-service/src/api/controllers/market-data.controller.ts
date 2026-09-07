import { Controller, Get, Param, Inject, UseGuards } from '@nestjs/common';
import { IMarketDataProvider, MARKET_PROVIDER_ADAPTER } from '../../application/ports/market-provider.adapter.interface';
import { PrismaService, Tick } from '@veerox/database';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

@Controller('market-data')
export class MarketDataController {
  constructor(
    @Inject(MARKET_PROVIDER_ADAPTER) private readonly provider: IMarketDataProvider,
    private readonly prisma: PrismaService,
  ) {}

  @Get('providers/status')
  @UseGuards(JwtAuthGuard)
  getProviderStatus(): { provider: string; status: { isConnected: boolean; latencyMs: number } } {
    // In a real multi-provider setup, we would fetch status per provider ID.
    // For now, we return the status of the single injected adapter.
    return {
      provider: 'mock-provider',
      status: this.provider.getHealthStatus(),
    };
  }

  @Get('symbols/:symbolId/tick/latest')
  @UseGuards(JwtAuthGuard)
  async getLatestTick(@Param('symbolId') symbolId: string): Promise<{ data: Tick | null }> {
    const latestTick = await this.prisma.tick.findFirst({
      where: { symbolId },
      orderBy: { timestamp: 'desc' },
    });
    
    if (!latestTick) {
      return { data: null };
    }
    
    return { data: latestTick };
  }
}
