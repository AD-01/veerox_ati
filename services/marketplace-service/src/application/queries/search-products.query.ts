import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaMarketplaceRepository, SearchProductsFilters } from '../../infrastructure/repositories/prisma-marketplace.repository';
import { MarketplaceProduct } from '../../domain/aggregates/marketplace-product.aggregate';

export class SearchProductsQuery {
  constructor(
    public readonly filters: SearchProductsFilters,
    public readonly skip: number = 0,
    public readonly take: number = 20
  ) {}
}

@QueryHandler(SearchProductsQuery)
export class SearchProductsHandler implements IQueryHandler<SearchProductsQuery> {
  constructor(private readonly marketplaceRepo: PrismaMarketplaceRepository) {}

  async execute(query: SearchProductsQuery): Promise<{ items: MarketplaceProduct[], total: number }> {
    return this.marketplaceRepo.search(query.filters, query.skip, query.take);
  }
}
