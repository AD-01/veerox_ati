import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceModule } from '../marketplace.module';
import { PrismaService } from '@veerox/database';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PublishProductCommand } from '../application/commands/publish-product.command';
import { ProductType, PricingModel } from '../domain/aggregates/marketplace-product.aggregate';
import { SearchProductsQuery } from '../application/queries/search-products.query';
import { InitiatePurchaseCommand } from '../application/commands/initiate-purchase.command';
import { SubmitReviewCommand } from '../application/commands/submit-review.command';
import { LicenseIssuedEvent } from '@veerox/events';
import { MarketplaceEventConsumer } from '../infrastructure/messaging/marketplace-event.consumer';
import { randomUUID } from 'crypto';

jest.setTimeout(120000);

describe('MarketplaceService (Integration)', () => {
  let moduleRef: TestingModule;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let prisma: PrismaService;
  let eventConsumer: MarketplaceEventConsumer;

  const vendorOrgId = randomUUID();
  const buyerOrgId = randomUUID();
  const buyerWorkspaceId = randomUUID();
  const buyerUserId = randomUUID();
  const vendorUserId = randomUUID();
  let createdProductId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MarketplaceModule,
        EventEmitterModule.forRoot()
      ],
      providers: [PrismaService]
    }).compile();

    await moduleRef.init(); // Required for CqrsModule to register handlers

    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
    prisma = moduleRef.get(PrismaService);
    eventConsumer = moduleRef.get(MarketplaceEventConsumer);

    await prisma.user.createMany({
      data: [
        { id: vendorUserId, email: `vendor-${Date.now()}@example.com`, username: `vendor-${Date.now()}`, passwordHash: 'dummy', firstName: 'Vendor', lastName: 'User' },
        { id: buyerUserId, email: `buyer-${Date.now()}@example.com`, username: `buyer-${Date.now()}`, passwordHash: 'dummy', firstName: 'Buyer', lastName: 'User' }
      ]
    });

    // Setup basic relations for the DB constraints
    await prisma.organization.createMany({
      data: [
        { id: vendorOrgId, name: `Vendor Org ${randomUUID().substring(0, 8)}`, slug: 'vendor-org-' + Date.now() + '-' + randomUUID().substring(0, 4), ownerUserId: vendorUserId },
        { id: buyerOrgId, name: `Buyer Org ${randomUUID().substring(0, 8)}`, slug: 'buyer-org-' + Date.now() + '-' + randomUUID().substring(0, 4), ownerUserId: buyerUserId }
      ]
    });
    
    await prisma.workspace.create({
      data: {
        id: buyerWorkspaceId,
        organizationId: buyerOrgId,
        name: 'Buyer Workspace'
      }
    });
  });

  afterAll(async () => {
    try {
      if (buyerWorkspaceId) await prisma.productReview.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.license.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.invoiceLine.deleteMany({ where: { invoice: { workspaceId: buyerWorkspaceId } } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.paymentAttempt.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.invoice.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.productSubscription.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (createdProductId) await prisma.marketplaceProduct.deleteMany({ where: { id: createdProductId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.idempotentCommand.deleteMany({ where: { workspaceId: buyerWorkspaceId } }).catch(() => {});
      if (buyerWorkspaceId) await prisma.workspace.deleteMany({ where: { id: buyerWorkspaceId } }).catch(() => {});
      if (buyerOrgId) await prisma.organization.deleteMany({ where: { id: { in: [buyerOrgId, vendorOrgId] } } }).catch(() => {});
      if (buyerUserId) await prisma.user.deleteMany({ where: { id: { in: [buyerUserId, vendorUserId] } } }).catch(() => {});
    } catch {
      // Cleanup best effort
    }
  });

  it('should publish a new product to marketplace (Vendor flow)', async () => {
    const cmd = new PublishProductCommand(
      vendorOrgId,
      'Titan Trend EA',
      'Advanced EURUSD Trend Follower',
      ProductType.EA,
      null,
      PricingModel.SUBSCRIPTION,
      49.99,
      'USD'
    );

    createdProductId = await commandBus.execute(cmd);
    expect(createdProductId).toBeDefined();

    const dbProduct = await prisma.marketplaceProduct.findUnique({
      where: { id: createdProductId }
    });

    expect(dbProduct).toBeDefined();
    expect(dbProduct?.name).toBe('Titan Trend EA');
    expect(dbProduct?.price.toNumber()).toBe(49.99);
    expect(dbProduct?.status).toBe('ACTIVE');
  });

  it('should find the product via search query (Buyer flow)', async () => {
    const query = new SearchProductsQuery(
      { searchTerm: 'Titan', productType: ProductType.EA },
      0,
      10
    );

    const result = await queryBus.execute(query);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.find((i: any) => i.id === createdProductId)).toBeDefined();
  });

  it('should initiate a purchase (Orchestration)', async () => {
    const cmd = new InitiatePurchaseCommand(
      buyerWorkspaceId,
      buyerOrgId,
      createdProductId,
      `idemp_test_${randomUUID()}`
    );

    const result = await commandBus.execute(cmd);
    expect(result.success).toBe(true);
    expect(result.subscriptionId).toBeDefined();
  });

  it('should increment purchase count upon receiving LicenseIssuedEvent', async () => {
    const event = new LicenseIssuedEvent(
      randomUUID(),
      buyerOrgId,
      buyerWorkspaceId,
      createdProductId,
      randomUUID(),
      'ABCD-1234'
    );

    await eventConsumer.handleLicenseIssuedEvent(event);

    const dbProduct = await prisma.marketplaceProduct.findUnique({
      where: { id: createdProductId }
    });

    expect(dbProduct?.purchaseCount).toBe(1);
  });

  it('should allow review submission only if active license is mocked', async () => {
    // 1. First, attempt to review WITHOUT license in db (LicensingGrpcClient will fail)
    const cmd = new SubmitReviewCommand(
      createdProductId,
      buyerWorkspaceId,
      buyerUserId,
      5,
      'Great EA!'
    );

    await expect(commandBus.execute(cmd)).rejects.toThrow('Workspace must hold an active license');

    // 2. Insert mock active license in DB (Since LicensingGrpcClient is just doing a DB lookup for now)
    await prisma.license.create({
      data: {
        id: randomUUID(),
        organizationId: buyerOrgId,
        workspaceId: buyerWorkspaceId,
        productId: createdProductId,
        licenseKey: 'MOCK-KEY-123',
        status: 'ACTIVE'
      }
    });

    // 3. Attempt again
    const reviewId = await commandBus.execute(cmd);
    expect(reviewId).toBeDefined();

    // 4. Verify average rating
    const dbProduct = await prisma.marketplaceProduct.findUnique({
      where: { id: createdProductId }
    });
    expect(dbProduct?.averageRating.toNumber()).toBe(5);
    expect(dbProduct?.reviewCount).toBe(1);
  });
});
