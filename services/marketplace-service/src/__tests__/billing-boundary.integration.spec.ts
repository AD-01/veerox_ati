import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '@veerox/database';
import { randomUUID } from 'crypto';
import { MarketplaceModule } from '../marketplace.module';
import { PublishProductCommand } from '../application/commands/publish-product.command';
import { InitiatePurchaseCommand } from '../application/commands/initiate-purchase.command';
import { PricingModel, ProductType } from '../domain/aggregates/marketplace-product.aggregate';

jest.setTimeout(120000);

describe('S-23 Phase 05 Remediation 01A: real Billing application boundary', () => {
  let moduleRef: TestingModule;
  let commandBus: CommandBus;
  let prisma: PrismaService;
  let productId: string;
  let buyerOrganizationId: string;
  let buyerWorkspaceId: string;
  let vendorOrganizationId: string;
  let userIds: string[];
  let organizationIds: string[];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [MarketplaceModule, EventEmitterModule.forRoot()]
    }).compile();
    await moduleRef.init();

    commandBus = moduleRef.get(CommandBus);
    prisma = moduleRef.get(PrismaService);

    const vendorUser = await prisma.user.create({
      data: {
        email: `vendor-${randomUUID()}@test.com`,
        username: `vendor-${randomUUID()}`,
        passwordHash: 'test',
        firstName: 'Vendor',
        lastName: 'Test'
      }
    });
    const buyerUser = await prisma.user.create({
      data: {
        email: `buyer-${randomUUID()}@test.com`,
        username: `buyer-${randomUUID()}`,
        passwordHash: 'test',
        firstName: 'Buyer',
        lastName: 'Test'
      }
    });
    userIds = [vendorUser.id, buyerUser.id];

    const vendor = await prisma.organization.create({
      data: { name: `Vendor ${randomUUID()}`, slug: `vendor-${randomUUID()}`, ownerUserId: vendorUser.id }
    });
    const buyer = await prisma.organization.create({
      data: { name: `Buyer ${randomUUID()}`, slug: `buyer-${randomUUID()}`, ownerUserId: buyerUser.id }
    });
    vendorOrganizationId = vendor.id;
    buyerOrganizationId = buyer.id;
    organizationIds = [vendor.id, buyer.id];

    const workspace = await prisma.workspace.create({
      data: { organizationId: buyer.id, name: `Buyer Workspace ${randomUUID()}` }
    });
    buyerWorkspaceId = workspace.id;

    productId = await commandBus.execute(new PublishProductCommand(
      vendor.id,
      'Boundary Test Product',
      'Real Billing boundary test product',
      ProductType.EA,
      randomUUID(),
      PricingModel.SUBSCRIPTION,
      25,
      'USD',
      '1.0.0',
      null,
      [],
      [],
      null
    ));
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.processedEvent.deleteMany({});
    await prisma.idempotentCommand.deleteMany({});
    await prisma.invoice.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.productSubscription.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.outboxMessage.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.workspace.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.marketplaceProduct.deleteMany({ where: { id: productId } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await moduleRef.close();
  });

  it('creates actual subscription, invoice, audit, and outbox records', async () => {
    const idempotencyKey = `boundary-${randomUUID()}`;
    const result = await commandBus.execute(new InitiatePurchaseCommand(
      buyerWorkspaceId,
      buyerOrganizationId,
      productId,
      idempotencyKey
    ));

    expect(result.success).toBe(true);
    expect(result.subscriptionId).not.toMatch(/^mock-/);
    expect(result.invoiceId).not.toMatch(/^mock-/);

    const subscription = await prisma.productSubscription.findUnique({ where: { id: result.subscriptionId } });
    const invoice = await prisma.invoice.findUnique({ where: { id: result.invoiceId } });
    const command = await prisma.idempotentCommand.findUnique({
      where: { idempotencyKey }
    });
    const outbox = await prisma.outboxMessage.findMany({
      where: { organizationId: buyerOrganizationId, workspaceId: buyerWorkspaceId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    const audits = await prisma.auditLog.findMany({
      where: { organizationId: buyerOrganizationId, workspaceId: buyerWorkspaceId, correlationId: result.correlationId }
    });

    expect(subscription?.id).toBe(result.subscriptionId);
    expect(subscription?.status).toBe('ACTIVE');
    expect(invoice?.id).toBe(result.invoiceId);
    expect(invoice?.status).toBe('ISSUED');
    expect(command?.resultId).toBe(result.subscriptionId);
    expect(outbox).toHaveLength(3);
    expect(outbox.map(message => message.eventType)).toEqual(expect.arrayContaining([
      'PurchaseCreatedEvent',
      'ProductSubscriptionActivatedEvent',
      'InvoiceIssuedEvent'
    ]));
    expect(audits.map(audit => audit.action)).toEqual(expect.arrayContaining(['PURCHASE_CREATED', 'INVOICE_ISSUED']));
  });

  it('returns the persisted result for duplicate and concurrent identical requests', async () => {
    const idempotencyKey = `concurrent-${randomUUID()}`;
    const command = new InitiatePurchaseCommand(buyerWorkspaceId, buyerOrganizationId, productId, idempotencyKey);
    const results = await Promise.all([commandBus.execute(command), commandBus.execute(command), commandBus.execute(command)]);
    const completed = results.filter(result => result.subscriptionId);
    const inFlight = results.filter(result => result.error === 'IN_FLIGHT');
    const subscriptions = await prisma.productSubscription.findMany({ where: { idempotencyKey } });
    const invoices = subscriptions.length === 1
      ? await prisma.invoice.findMany({ where: { subscriptionId: subscriptions[0].id } })
      : [];
    const idempotentCommand = await prisma.idempotentCommand.findUnique({ where: { idempotencyKey } });
    const outbox = await prisma.outboxMessage.findMany({ where: { idempotencyKey: { not: null }, workspaceId: buyerWorkspaceId } });

    expect(completed.length + inFlight.length).toBe(3);
    expect(subscriptions).toHaveLength(1);
    expect(outbox.filter(message => message.aggregateId === subscriptions[0].id).length).toBeGreaterThanOrEqual(1);
  });

  it('rejects a workspace/organization mismatch before Billing mutation', async () => {
    const idempotencyKey = `tenant-${randomUUID()}`;
    const subscriptionsBefore = await prisma.productSubscription.count({ where: { workspaceId: buyerWorkspaceId, productId } });
    await expect(commandBus.execute(new InitiatePurchaseCommand(
      buyerWorkspaceId,
      vendorOrganizationId,
      productId,
      idempotencyKey
    ))).rejects.toThrow('Workspace does not belong to organization');

    expect(await prisma.productSubscription.count({ where: { workspaceId: buyerWorkspaceId, productId } })).toBe(subscriptionsBefore);
    expect(await prisma.idempotentCommand.count({ where: { idempotencyKey } })).toBe(0);
  });
});