import { AggregateRoot } from '@nestjs/cqrs';

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  SUSPENDED = 'SUSPENDED'
}

export enum PricingModel {
  SUBSCRIPTION = 'SUBSCRIPTION',
  ONE_TIME = 'ONE_TIME',
  USAGE = 'USAGE'
}

export enum ProductType {
  EA = 'EA',
  STRATEGY = 'STRATEGY',
  AI_MODEL = 'AI_MODEL'
}

export class MarketplaceProduct extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string, // Vendor
    public name: string,
    public description: string | null,
    public readonly productType: ProductType,
    public assetId: string | null,
    public pricingModel: PricingModel,
    public price: number,
    public currency: string,
    public status: ProductStatus,
    public version: string | null,
    public iconUrl: string | null,
    public mediaUrls: string[],
    public features: string[],
    public requirements: any | null,
    public averageRating: number,
    public reviewCount: number,
    public purchaseCount: number,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {
    super();
  }

  static publish(props: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    productType: ProductType;
    assetId: string | null;
    pricingModel: PricingModel;
    price: number;
    currency: string;
    version: string | null;
    iconUrl: string | null;
    mediaUrls: string[];
    features: string[];
    requirements: any | null;
  }): MarketplaceProduct {
    return new MarketplaceProduct(
      props.id,
      props.organizationId,
      props.name,
      props.description,
      props.productType,
      props.assetId,
      props.pricingModel,
      props.price,
      props.currency,
      ProductStatus.ACTIVE,
      props.version,
      props.iconUrl,
      props.mediaUrls,
      props.features,
      props.requirements,
      0, // averageRating
      0, // reviewCount
      0, // purchaseCount
      new Date(),
      new Date()
    );
  }

  updateMetadata(props: {
    name?: string;
    description?: string;
    version?: string;
    iconUrl?: string;
    mediaUrls?: string[];
    features?: string[];
    requirements?: any;
  }): void {
    if (props.name !== undefined) this.name = props.name;
    if (props.description !== undefined) this.description = props.description;
    if (props.version !== undefined) this.version = props.version;
    if (props.iconUrl !== undefined) this.iconUrl = props.iconUrl;
    if (props.mediaUrls !== undefined) this.mediaUrls = props.mediaUrls;
    if (props.features !== undefined) this.features = props.features;
    if (props.requirements !== undefined) this.requirements = props.requirements;

    this.updatedAt = new Date();
  }

  archive(): void {
    if (this.status !== ProductStatus.ACTIVE) {
      throw new Error(`Cannot archive product from status ${this.status}`);
    }
    this.status = ProductStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  incrementPurchaseCount(): void {
    this.purchaseCount++;
    this.updatedAt = new Date();
  }

  applyReviewRating(newRating: number, previousRating?: number): void {
    // Basic rolling average
    if (previousRating !== undefined) {
      // It's an update to an existing review
      const totalSum = this.averageRating * this.reviewCount;
      this.averageRating = (totalSum - previousRating + newRating) / this.reviewCount;
    } else {
      // It's a new review
      const totalSum = (this.averageRating * this.reviewCount) + newRating;
      this.reviewCount++;
      this.averageRating = totalSum / this.reviewCount;
    }
    this.updatedAt = new Date();
  }
}
