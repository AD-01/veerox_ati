import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from '../api/controllers/billing.controller';
import { PrismaService } from '@veerox/database';
import { SubscriptionService } from '../application/services/subscription.service';
import { InvoiceService } from '../application/services/invoice.service';
import { PaymentService } from '../application/services/payment.service';
import { UsageService } from '../application/services/usage.service';
import { BillingLedgerService } from '../application/services/billing-ledger.service';
import { BillingPurchaseService } from '../application/services/billing-purchase.service';
import { PrismaSubscriptionRepository } from '../infrastructure/repositories/prisma-subscription.repository';
import { PrismaInvoiceRepository } from '../infrastructure/repositories/prisma-invoice.repository';
import { PrismaPaymentAttemptRepository } from '../infrastructure/repositories/prisma-payment-attempt.repository';
import { PrismaUsageRepository } from '../infrastructure/repositories/prisma-usage.repository';
import { PrismaBillingLedgerRepository } from '../infrastructure/repositories/prisma-billing-ledger.repository';
import { PrismaAuditRepository } from '../infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository } from '../infrastructure/repositories/prisma-outbox.repository';
import { MockPaymentProvider } from '../infrastructure/payment/mock-payment-provider';
import { randomUUID } from 'crypto';

jest.setTimeout(120000);

describe('BillingController Integration Tests (S-24 Phase 01)', () => {
  let controller: BillingController;
  let prisma: PrismaService;
  let subService: SubscriptionService;
  let invoiceService: InvoiceService;

  let orgId: string;
  let workspaceId: string;
  let productId: string;
  let userId: string;
  let subscriptionId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        PrismaService,
        SubscriptionService,
        InvoiceService,
        PaymentService,
        UsageService,
        BillingLedgerService,
        BillingPurchaseService,
        PrismaSubscriptionRepository,
        PrismaInvoiceRepository,
        PrismaPaymentAttemptRepository,
        PrismaUsageRepository,
        PrismaBillingLedgerRepository,
        PrismaAuditRepository,
        PrismaOutboxRepository,
        { provide: 'ISubscriptionRepository', useExisting: PrismaSubscriptionRepository },
        { provide: 'IInvoiceRepository', useExisting: PrismaInvoiceRepository },
        { provide: 'IPaymentAttemptRepository', useExisting: PrismaPaymentAttemptRepository },
        { provide: 'IUsageRecordRepository', useExisting: PrismaUsageRepository },
        { provide: 'IBillingLedgerRepository', useExisting: PrismaBillingLedgerRepository },
        { provide: 'IAuditRepository', useClass: PrismaAuditRepository },
        { provide: 'IOutboxRepository', useClass: PrismaOutboxRepository },
        { provide: 'PaymentProvider', useClass: MockPaymentProvider },
      ],
    }).compile();

    await moduleRef.init();

    controller = moduleRef.get<BillingController>(BillingController);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    subService = moduleRef.get<SubscriptionService>(SubscriptionService);
    invoiceService = moduleRef.get<InvoiceService>(InvoiceService);

    const user = await prisma.user.create({
      data: {
        email: `trader-bill-${randomUUID()}@veerox.com`,
        username: `user-bill-${randomUUID()}`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    userId = user.id;

    const org = await prisma.organization.create({
      data: {
        name: `Billing Org ${randomUUID().substring(0, 8)}`,
        slug: `bill-org-${randomUUID()}`,
        ownerUserId: user.id,
      },
    });
    orgId = org.id;

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Billing Test Workspace',
      },
    });
    workspaceId = workspace.id;

    const product = await prisma.marketplaceProduct.create({
      data: {
        organizationId: org.id,
        name: 'Test Billing Product',
        productType: 'STRATEGY',
        pricingModel: 'SUBSCRIPTION',
        price: 99.00,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // Create a subscription & invoice directly via services
    subscriptionId = await subService.createSubscription({
      organizationId: org.id,
      workspaceId: workspace.id,
      productId: product.id,
      billingPeriod: 'MONTHLY',
    });

    invoiceId = await invoiceService.createInvoice({
      organizationId: org.id,
      workspaceId: workspace.id,
      subscriptionId,
      currency: 'USD',
    });

    await invoiceService.addLine(invoiceId, 'Monthly Subscription Charge', (99.00 as any), org.id, workspace.id);
    await invoiceService.issueInvoice(invoiceId, org.id, workspace.id);
  });

  afterAll(async () => {
    try {
      if (workspaceId) await prisma.billingLedgerEntry.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.usageRecord.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.paymentAttempt.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.invoiceLine.deleteMany({ where: { invoice: { workspaceId } } }).catch(() => {});
      if (workspaceId) await prisma.invoice.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (workspaceId) await prisma.productSubscription.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (productId) await prisma.marketplaceProduct.deleteMany({ where: { id: productId } }).catch(() => {});
      if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } }).catch(() => {});
      if (orgId) await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      if (userId) await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    } catch {
      // Cleanup best effort
    }
  });

  it('1. should retrieve workspace subscriptions via GET /workspaces/:workspaceId/subscriptions', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getWorkspaceSubscriptions(req, workspaceId);

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.some(s => s.id === subscriptionId)).toBe(true);
  });

  it('2. should retrieve subscription details via GET /subscriptions/:id', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getSubscription(req, subscriptionId);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(subscriptionId);
    expect(res.data.productId).toBe(productId);
  });

  it('3. should retrieve workspace invoices via GET /workspaces/:workspaceId/invoices', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getWorkspaceInvoices(req, workspaceId);

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.some(i => i.id === invoiceId)).toBe(true);
  });

  it('4. should retrieve invoice details via GET /invoices/:id', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getInvoice(req, invoiceId);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(invoiceId);
    expect(res.data.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('5. should pay invoice via POST /invoices/:id/pay', async () => {
    const idempotencyKey = `idemp_pay_${randomUUID()}`;
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.payInvoice(req, invoiceId, { idempotencyKey });

    expect(res.success).toBe(true);
    expect(res.message).toContain('paid successfully');

    // Verify invoice status is now PAID
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe('PAID');
  });

  it('6. should record and retrieve usage via POST /usage and GET /workspaces/:workspaceId/usage', async () => {
    const req = { workspaceId, organizationId: orgId };
    const recordRes = await controller.recordUsage(req, workspaceId, {
      productId,
      metricName: 'api_calls',
      quantity: 1500,
    });

    expect(recordRes.success).toBe(true);
    expect(recordRes.data.usageId).toBeDefined();

    const getRes = await controller.getWorkspaceUsage(req, workspaceId, 'api_calls');
    expect(getRes.success).toBe(true);
    expect(getRes.data.length).toBeGreaterThanOrEqual(1);
    expect(getRes.data[0].metricName).toBe('api_calls');
  });

  it('7. should retrieve ledger summary via GET /workspaces/:workspaceId/ledger', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getWorkspaceLedger(req, workspaceId);

    expect(res.success).toBe(true);
    expect(res.data.summary).toBeDefined();
    expect(res.data.summary.totalCharges).toBeDefined();
  });

  it('8. should cancel subscription via POST /subscriptions/:id/cancel', async () => {
    // Activate subscription first so it can be canceled
    await subService.activateSubscription(subscriptionId, new Date(Date.now() + 30 * 86400000), orgId, workspaceId);

    const req = { workspaceId, organizationId: orgId };
    const res = await controller.cancelSubscription(req, subscriptionId, {});

    expect(res.success).toBe(true);
    const sub = await prisma.productSubscription.findUnique({ where: { id: subscriptionId } });
    expect(sub?.status).toBe('CANCELED');
  });
});
