import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { MarketQuoteDto } from '@veerox/contracts';
import { GetWorkspaceMarketQuotesQuery } from '../queries/get-workspace-market-quotes.query';

@QueryHandler(GetWorkspaceMarketQuotesQuery)
export class GetWorkspaceMarketQuotesQueryHandler implements IQueryHandler<GetWorkspaceMarketQuotesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspaceMarketQuotesQuery): Promise<MarketQuoteDto[]> {
    // 1. Get active connectors for this workspace to determine authorized providers
    const connectors = await this.prisma.connector.findMany({
      where: { workspaceId: query.workspaceId },
      select: { provider: true }
    });
    
    if (connectors.length === 0) {
      return [];
    }
    
    // We get distinct provider names (e.g., "MT5", "MOCK")
    const providerNames = [...new Set(connectors.map(c => c.provider))];
    
    // 2. Map provider names to MarketProvider IDs
    const marketProviders = await this.prisma.marketProvider.findMany({
      where: { name: { in: providerNames } },
      select: { id: true }
    });
    
    if (marketProviders.length === 0) {
      return [];
    }
    
    const providerIds = marketProviders.map(p => p.id);
    
    // 3. Get symbols authorized for these providers
    const symbols = await this.prisma.symbol.findMany({
      where: { providerId: { in: providerIds } },
      select: { id: true, standardSymbol: true, brokerSymbol: true }
    });
    
    if (symbols.length === 0) {
      return [];
    }
    
    const symbolIds = symbols.map(s => s.id);
    
    // 4. Efficiently fetch the LATEST tick for each authorized symbol
    const latestTicks = await this.prisma.tick.findMany({
      where: { symbolId: { in: symbolIds } },
      orderBy: { timestamp: 'desc' },
      distinct: ['symbolId'],
    });
    
    // 5. Map results to DTO. Symbols without a tick will simply be omitted.
    const result: MarketQuoteDto[] = latestTicks.map(tick => {
      const symbol = symbols.find(s => s.id === tick.symbolId)!;
      const bid = Number(tick.bid);
      const ask = Number(tick.ask);
      
      return {
        symbolId: symbol.id,
        brokerSymbol: symbol.brokerSymbol,
        standardSymbol: symbol.standardSymbol,
        bid,
        ask,
        spread: ask - bid,
        timestamp: tick.timestamp,
      };
    });
    
    return result;
  }
}
