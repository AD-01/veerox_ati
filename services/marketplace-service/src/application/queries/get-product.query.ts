import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaMarketplaceRepository } from '../../infrastructure/repositories/prisma-marketplace.repository';
import { MarketplaceProduct } from '../../domain/aggregates/marketplace-product.aggregate';

export class GetProductQuery {
  constructor(
    public readonly productId: string
  ) {}
}

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(private readonly marketplaceRepo: PrismaMarketplaceRepository) {}

  async execute(query: GetProductQuery): Promise<MarketplaceProduct | null> {
    return this.marketplaceRepo.findById(query.productId);
  }
}
