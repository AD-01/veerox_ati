import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaReviewRepository } from '../../infrastructure/repositories/prisma-review.repository';
import { PrismaMarketplaceRepository } from '../../infrastructure/repositories/prisma-marketplace.repository';
import { LicensingGrpcClient } from '../../infrastructure/grpc/licensing-grpc.client';
import { ProductReview } from '../../domain/aggregates/product-review.aggregate';
import { randomUUID } from 'crypto';
import { PrismaService } from '@veerox/database';
import { AppException } from '@veerox/shared';

export class SubmitReviewCommand {
  constructor(
    public readonly productId: string,
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly rating: number,
    public readonly comment: string | null
  ) {}
}

@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler implements ICommandHandler<SubmitReviewCommand> {
  constructor(
    private readonly reviewRepo: PrismaReviewRepository,
    private readonly marketplaceRepo: PrismaMarketplaceRepository,
    private readonly licensingClient: LicensingGrpcClient,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: SubmitReviewCommand): Promise<string> {
    const product = await this.marketplaceRepo.findById(command.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Must have active license to review
    const hasLicense = await this.licensingClient.checkWorkspaceHasActiveLicense(command.workspaceId, command.productId);
    if (!hasLicense) {
      throw new Error('Workspace must hold an active license to review this product');
    }

    // Check if review already exists
    let review = await this.reviewRepo.findByWorkspaceAndProduct(command.workspaceId, command.productId);
    let previousRating: number | undefined;

    if (review) {
      previousRating = review.rating;
      review.update({
        rating: command.rating,
        comment: command.comment ?? undefined
      });
    } else {
      review = ProductReview.submit({
        id: randomUUID(),
        productId: command.productId,
        workspaceId: command.workspaceId,
        userId: command.userId,
        rating: command.rating,
        comment: command.comment
      });
    }

    // Apply rating to product aggregate
    product.applyReviewRating(command.rating, previousRating);

    // Save transactionally
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.reviewRepo.save(review!, tx);
        await this.marketplaceRepo.save(product, tx);
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // CRITICAL: Translate database uniqueness constraint violation to domain error
        throw new AppException(
          'DUPLICATE_REVIEW',
          `Review already submitted by workspace ${command.workspaceId} for product ${command.productId}`,
          409,
          { workspaceId: command.workspaceId, productId: command.productId }
        );
      }
      throw error;
    }

    return review.id;
  }
}

