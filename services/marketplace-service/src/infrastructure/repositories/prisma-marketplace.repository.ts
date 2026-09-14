import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { MarketplaceProduct, PricingModel, ProductStatus, ProductType } from '../../domain/aggregates/marketplace-product.aggregate';
import { Prisma } from '@veerox/database';

export interface SearchProductsFilters {
  searchTerm?: string;
  productType?: ProductType;
  minRating?: number;
  organizationId?: string;
}

@Injectable()
export class PrismaMarketplaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<MarketplaceProduct | null> {
    const client = tx || this.prisma;
    const record = await client.marketplaceProduct.findUnique({ where: { id } });
    if (!record) return null;

    return this.mapToAggregate(record);
  }

  async search(filters: SearchProductsFilters, skip: number = 0, take: number = 20): Promise<{ items: MarketplaceProduct[], total: number }> {
    const where: Prisma.MarketplaceProductWhereInput = {
      status: ProductStatus.ACTIVE, // By default only search active
    };

    if (filters.searchTerm) {
      where.OR = [
        { name: { contains: filters.searchTerm, mode: 'insensitive' } },
        { description: { contains: filters.searchTerm, mode: 'insensitive' } }
      ];
    }
    
    if (filters.productType) {
      where.productType = filters.productType;
    }

    if (filters.minRating) {
      where.averageRating = { gte: filters.minRating };
    }

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    const [total, records] = await Promise.all([
      this.prisma.marketplaceProduct.count({ where }),
      this.prisma.marketplaceProduct.findMany({
        where,
        skip,
        take,
        orderBy: { averageRating: 'desc' }
      })
    ]);

    return {
      total,
      items: records.map(record => this.mapToAggregate(record))
    };
  }

  async save(product: MarketplaceProduct, tx?: any): Promise<void> {
    const data = {
      id: product.id,
      organizationId: product.organizationId,
      name: product.name,
      description: product.description,
      productType: product.productType,
      assetId: product.assetId,
      pricingModel: product.pricingModel,
      price: product.price,
      currency: product.currency,
      status: product.status,
      version: product.version,
      iconUrl: product.iconUrl,
      mediaUrls: JSON.stringify(product.mediaUrls),
      features: JSON.stringify(product.features),
      requirements: product.requirements ? JSON.stringify(product.requirements) : null,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      purchaseCount: product.purchaseCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    const client = tx || this.prisma;
    await client.marketplaceProduct.upsert({
      where: { id: product.id },
      create: data,
      update: data
    });
  }

  private mapToAggregate(record: any): MarketplaceProduct {
    return new MarketplaceProduct(
      record.id,
      record.organizationId,
      record.name,
      record.description,
      record.productType as ProductType,
      record.assetId,
      record.pricingModel as PricingModel,
      Number(record.price),
      record.currency,
      record.status as ProductStatus,
      record.version,
      record.iconUrl,
      record.mediaUrls ? JSON.parse(record.mediaUrls) : [],
      record.features ? JSON.parse(record.features) : [],
      record.requirements ? JSON.parse(record.requirements) : null,
      Number(record.averageRating),
      record.reviewCount,
      record.purchaseCount,
      record.createdAt,
      record.updatedAt
    );
  }
}
