import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { ProductReview } from '../../domain/aggregates/product-review.aggregate';
import { Prisma } from '@veerox/database';

@Injectable()
export class PrismaReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductReview | null> {
    const record = await this.prisma.productReview.findUnique({ where: { id } });
    if (!record) return null;

    return this.mapToAggregate(record);
  }

  async findByWorkspaceAndProduct(workspaceId: string, productId: string): Promise<ProductReview | null> {
    const record = await this.prisma.productReview.findUnique({
      where: {
        productId_workspaceId: {
          productId,
          workspaceId
        }
      }
    });
    if (!record) return null;
    return this.mapToAggregate(record);
  }

  async getReviewsForProduct(productId: string, skip: number = 0, take: number = 10): Promise<{ items: ProductReview[], total: number }> {
    const where = { productId };

    const [total, records] = await Promise.all([
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      total,
      items: records.map(record => this.mapToAggregate(record))
    };
  }

  async save(review: ProductReview, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    const data = {
      id: review.id,
      productId: review.productId,
      workspaceId: review.workspaceId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    };

    await client.productReview.upsert({
      where: { id: review.id },
      create: data,
      update: data
    });
  }

  private mapToAggregate(record: any): ProductReview {
    return new ProductReview(
      record.id,
      record.productId,
      record.workspaceId,
      record.userId,
      record.rating,
      record.comment,
      record.createdAt,
      record.updatedAt
    );
  }
}
