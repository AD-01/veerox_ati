import { Controller, Get, Post, Body, Param, Query, Headers, Req, HttpCode, HttpStatus, NotFoundException, BadRequestException, UseGuards } from '@nestjs/common';
import { WorkspaceScopeGuard, WorkspaceReadAccess, WorkspaceManageAccess, OrganizationManageAccess, CurrentUser } from '@veerox/shared';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SearchProductsQuery } from '../../application/queries/search-products.query';
import { GetProductQuery } from '../../application/queries/get-product.query';
import { GetWorkspacePurchasesQuery } from '../../application/queries/get-workspace-purchases.query';
import { GetWorkspaceLicenseQuery } from '../../application/queries/get-workspace-license.query';
import { InitiatePurchaseCommand } from '../../application/commands/initiate-purchase.command';
import { SubmitReviewCommand } from '../../application/commands/submit-review.command';
import { PublishProductCommand } from '../../application/commands/publish-product.command';
import { PricingModel, ProductType } from '../../domain/aggregates/marketplace-product.aggregate';
import { randomUUID } from 'crypto';

export interface SearchProductsQueryDto {
  searchTerm?: string;
  productType?: ProductType;
  minRating?: string;
  organizationId?: string;
  skip?: string;
  take?: string;
}

export interface PublishProductDto {
  organizationId: string;
  name: string;
  description?: string;
  productType: ProductType;
  assetId?: string;
  pricingModel: PricingModel;
  price: number;
  currency?: string;
  version?: string;
  iconUrl?: string;
  mediaUrls?: string[];
  features?: string[];
  requirements?: Record<string, any>;
}

export interface InitiatePurchaseDto {
  idempotencyKey?: string;
}

export interface SubmitReviewDto {
  rating: number;
  comment?: string;
}

@Controller('api/v1/marketplace')
export class MarketplaceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('products')
  async searchProducts(@Query() query: SearchProductsQueryDto): Promise<{ success: boolean; data: any[]; total: number; skip: number; take: number }> {
    const filters = {
      searchTerm: query.searchTerm,
      productType: query.productType,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      organizationId: query.organizationId,
    };
    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = query.take ? parseInt(query.take, 10) : 20;

    const result = await this.queryBus.execute(new SearchProductsQuery(filters, skip, take));
    return {
      success: true,
      data: result.items,
      total: result.total,
      skip,
      take,
    };
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string): Promise<{ success: boolean; data: any }> {
    const product = await this.queryBus.execute(new GetProductQuery(id));
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return {
      success: true,
      data: product,
    };
  }

  @Post('organizations/:organizationId/products')
  @UseGuards(WorkspaceScopeGuard)
  @OrganizationManageAccess()
  @HttpCode(HttpStatus.CREATED)
  async publishProduct(@Req() req: any, @Param('organizationId') paramOrgId: string, @Body() body: PublishProductDto): Promise<{ success: boolean; data: { id: string } }> {
    if (!body.name || !body.productType || !body.pricingModel || body.price === undefined) {
      throw new BadRequestException('Missing required product fields: name, productType, pricingModel, price');
    }

    const orgId = req.organizationId || paramOrgId;
    const command = new PublishProductCommand(
      orgId,
      body.name,
      body.description || null,
      body.productType,
      body.assetId || null,
      body.pricingModel,
      body.price,
      body.currency || 'USD',
      body.version || null,
      body.iconUrl || null,
      body.mediaUrls || [],
      body.features || [],
      body.requirements || null,
    );

    const productId = await this.commandBus.execute(command);
    return {
      success: true,
      data: { id: productId },
    };
  }

  @Post('workspaces/:workspaceId/products/:id/purchase')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceManageAccess()
  @HttpCode(HttpStatus.OK)
  async initiatePurchase(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: InitiatePurchaseDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ): Promise<{ success: boolean; data: any }> {
    const idempotencyKey = body.idempotencyKey || headerIdempotencyKey || randomUUID();

    try {
      const command = new InitiatePurchaseCommand(
        req.workspaceId,
        req.organizationId,
        productId,
        idempotencyKey,
      );

      const result = await this.commandBus.execute(command);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Purchase initiation failed');
    }
  }

  @Post('workspaces/:workspaceId/products/:id/reviews')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param('id') productId: string,
    @Body() body: SubmitReviewDto,
  ): Promise<{ success: boolean; data: { reviewId: string } }> {
    if (body.rating === undefined) {
      throw new BadRequestException('rating is required');
    }

    try {
      const command = new SubmitReviewCommand(
        productId,
        req.workspaceId,
        user.id,
        body.rating,
        body.comment || null,
      );

      const reviewId = await this.commandBus.execute(command);
      return {
        success: true,
        data: { reviewId },
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Review submission failed');
    }
  }

  @Get('workspaces/:workspaceId/purchases')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspacePurchases(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const purchases = await this.queryBus.execute(
      new GetWorkspacePurchasesQuery(req.workspaceId, req.organizationId),
    );

    return {
      success: true,
      data: purchases,
    };
  }

  @Get('workspaces/:workspaceId/licenses/:productId')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceLicense(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('productId') productId: string,
  ): Promise<{ success: boolean; data: any }> {
    const license = await this.queryBus.execute(
      new GetWorkspaceLicenseQuery(req.workspaceId, productId, req.organizationId),
    );

    if (!license) {
      throw new NotFoundException(`No active license found for workspace ${workspaceId} and product ${productId}`);
    }

    return {
      success: true,
      data: license,
    };
  }
}
