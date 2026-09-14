import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, CommandBus, QueryBus } from '@nestjs/cqrs';
import { MarketplaceController } from '../interfaces/rest/marketplace.controller';
import { PrismaService } from '@veerox/database';
import { PrismaMarketplaceRepository } from '../infrastructure/repositories/prisma-marketplace.repository';
import { PrismaReviewRepository } from '../infrastructure/repositories/prisma-review.repository';
import { BillingGrpcClient } from '../infrastructure/grpc/billing-grpc.client';
import { LicensingGrpcClient } from '../infrastructure/grpc/licensing-grpc.client';
import { PublishProductHandler } from '../application/commands/publish-product.command';
import { InitiatePurchaseHandler } from '../application/commands/initiate-purchase.command';
import { SubmitReviewHandler } from '../application/commands/submit-review.command';
import { SearchProductsHandler } from '../application/queries/search-products.query';
import { GetProductHandler } from '../application/queries/get-product.query';
import { GetWorkspacePurchasesHandler } from '../application/queries/get-workspace-purchases.query';
import { GetWorkspaceLicenseHandler } from '../application/queries/get-workspace-license.query';
import { BillingPurchaseService } from '../../../billing-service/src/application/services/billing-purchase.service';
import { PrismaSubscriptionRepository } from '../../../billing-service/src/infrastructure/repositories/prisma-subscription.repository';
import { PrismaInvoiceRepository } from '../../../billing-service/src/infrastructure/repositories/prisma-invoice.repository';
import { PrismaAuditRepository as BillingPrismaAuditRepository } from '../../../billing-service/src/infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository as BillingPrismaOutboxRepository } from '../../../billing-service/src/infrastructure/repositories/prisma-outbox.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

jest.setTimeout(120000);

describe('MarketplaceController Integration Tests (S-24 Phase 01)', () => {
  let controller: MarketplaceController;
  let prisma: PrismaService;

  let orgId: string;
  let workspaceId: string;
  let userId: string;
  let vendorOrgId: string;
  let vendorUserId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [MarketplaceController],
      providers: [
        PrismaService,
        PrismaMarketplaceRepository,
        PrismaReviewRepository,
        PrismaSubscriptionRepository,
        PrismaInvoiceRepository,
        BillingPrismaAuditRepository,
        BillingPrismaOutboxRepository,
        BillingGrpcClient,
        LicensingGrpcClient,
        PublishProductHandler,
        InitiatePurchaseHandler,
        SubmitReviewHandler,
        SearchProductsHandler,
        GetProductHandler,
        GetWorkspacePurchasesHandler,
        GetWorkspaceLicenseHandler,
        BillingPurchaseService,
        { provide: 'ISubscriptionRepository', useExisting: PrismaSubscriptionRepository },
        { provide: 'IInvoiceRepository', useExisting: PrismaInvoiceRepository },
        { provide: 'IAuditRepository', useClass: BillingPrismaAuditRepository },
        { provide: 'IOutboxRepository', useClass: BillingPrismaOutboxRepository },
      ],
    }).compile();

    await moduleRef.init();

    controller = moduleRef.get<MarketplaceController>(MarketplaceController);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Setup test tenant fixtures
    const buyerUser = await prisma.user.create({
      data: {
        email: `buyer-${randomUUID()}@veerox.com`,
        username: `buyer-${randomUUID()}`,
        passwordHash: 'hash',
        firstName: 'Buyer',
        lastName: 'User',
      },
    });
    userId = buyerUser.id;

    const vendorUser = await prisma.user.create({
      data: {
        email: `vendor-${randomUUID()}@veerox.com`,
        username: `vendor-${randomUUID()}`,
        passwordHash: 'hash',
        firstName: 'Vendor',
        lastName: 'User',
      },
    });
    vendorUserId = vendorUser.id;

    const buyerOrg = await prisma.organization.create({
      data: {
        name: `Buyer Org ${randomUUID().substring(0, 8)}`,
        slug: `buyer-org-${randomUUID()}`,
        ownerUserId: buyerUser.id,
      },
    });
    orgId = buyerOrg.id;

    const vendorOrg = await prisma.organization.create({
      data: {
        name: `Vendor Org ${randomUUID().substring(0, 8)}`,
        slug: `vendor-org-${randomUUID()}`,
        ownerUserId: vendorUser.id,
      },
    });
    vendorOrgId = vendorOrg.id;

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: buyerOrg.id,
        name: 'Trading Workspace S24',
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    try {
      if (workspaceId) await prisma.productReview.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.license.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.invoiceLine.deleteMany({ where: { invoice: { workspaceId } } }).catch(() => {});
      if (workspaceId) await prisma.paymentAttempt.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.invoice.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.productSubscription.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (vendorOrgId) await prisma.marketplaceProduct.deleteMany({ where: { organizationId: vendorOrgId } }).catch(() => {});
      if (workspaceId) await prisma.idempotentCommand.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } }).catch(() => {});
      if (orgId) await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      if (vendorOrgId) await prisma.organization.deleteMany({ where: { id: vendorOrgId } }).catch(() => {});
      if (userId) await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
      if (vendorUserId) await prisma.user.deleteMany({ where: { id: vendorUserId } }).catch(() => {});
    } catch {
      // Cleanup best effort
    }
  });

  let createdProductId: string;

  it('1. should publish a new marketplace product via POST /products', async () => {
    const res = await controller.publishProduct({} as any, vendorOrgId, {
      organizationId: vendorOrgId,
      name: 'Alpha Quant Strategy EA',
      productType: 'EA' as any,
      pricingModel: 'SUBSCRIPTION' as any,
      price: 199.99,
      currency: 'USD',
      description: 'High-frequency momentum expert advisor',
      version: '1.0.0',
      features: ['Auto-rebalancing', 'Trailing stop'],
    });

    expect(res.success).toBe(true);
    expect(res.data.id).toBeDefined();
    createdProductId = res.data.id;
  });

  it('2. should search and filter products via GET /products', async () => {
    const res = await controller.searchProducts({
      searchTerm: 'Alpha Quant',
      productType: 'EA' as any,
      skip: '0',
      take: '10',
    });

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.some((p: any) => p.id === createdProductId)).toBe(true);
  });

  it('3. should retrieve product details via GET /products/:id', async () => {
    const res = await controller.getProduct(createdProductId);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(createdProductId);
    expect(res.data.name).toBe('Alpha Quant Strategy EA');
  });

  it('4. should throw NotFoundException for non-existent product via GET /products/:id', async () => {
    await expect(controller.getProduct(randomUUID())).rejects.toThrow(NotFoundException);
  });

  it('5. should initiate a purchase via POST /products/:id/purchase', async () => {
    const idempotencyKey = `idemp_mkt_${randomUUID()}`;
    const res = await controller.initiatePurchase({ workspaceId, organizationId: orgId } as any, createdProductId, {
      idempotencyKey,
    });

    expect(res.success).toBe(true);
    expect(res.data.subscriptionId).toBeDefined();
    expect(res.data.invoiceId).toBeDefined();
  });

  it('6. should retrieve workspace purchases via GET /workspaces/:workspaceId/purchases', async () => {
    const res = await controller.getWorkspacePurchases(workspaceId, orgId);

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.some((p: any) => p.productId === createdProductId)).toBe(true);
  });
});
