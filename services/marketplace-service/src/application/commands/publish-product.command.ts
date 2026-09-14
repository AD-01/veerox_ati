import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaMarketplaceRepository } from '../../infrastructure/repositories/prisma-marketplace.repository';
import { MarketplaceProduct, PricingModel, ProductType } from '../../domain/aggregates/marketplace-product.aggregate';
import { randomUUID } from 'crypto';

export class PublishProductCommand {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly productType: ProductType,
    public readonly assetId: string | null,
    public readonly pricingModel: PricingModel,
    public readonly price: number,
    public readonly currency: string,
    public readonly version: string | null = null,
    public readonly iconUrl: string | null = null,
    public readonly mediaUrls: string[] = [],
    public readonly features: string[] = [],
    public readonly requirements: any | null = null
  ) {}
}

@CommandHandler(PublishProductCommand)
export class PublishProductHandler implements ICommandHandler<PublishProductCommand> {
  constructor(
    private readonly marketplaceRepo: PrismaMarketplaceRepository
  ) {}

  async execute(command: PublishProductCommand): Promise<string> {
    const productId = randomUUID();

    const product = MarketplaceProduct.publish({
      id: productId,
      organizationId: command.organizationId,
      name: command.name,
      description: command.description,
      productType: command.productType,
      assetId: command.assetId,
      pricingModel: command.pricingModel,
      price: command.price,
      currency: command.currency,
      version: command.version,
      iconUrl: command.iconUrl,
      mediaUrls: command.mediaUrls,
      features: command.features,
      requirements: command.requirements
    });

    await this.marketplaceRepo.save(product);
    return productId;
  }
}
