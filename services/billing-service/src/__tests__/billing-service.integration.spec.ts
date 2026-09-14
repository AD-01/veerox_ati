/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { SubscriptionService } from '../application/services/subscription.service';
import { InvoiceService } from '../application/services/invoice.service';
import { BillingLedgerService } from '../application/services/billing-ledger.service';
import { PaymentService } from '../application/services/payment.service';
import { UsageService } from '../application/services/usage.service';
import { PrismaSubscriptionRepository } from '../infrastructure/repositories/prisma-subscription.repository';
import { PrismaInvoiceRepository } from '../infrastructure/repositories/prisma-invoice.repository';
import { PrismaBillingLedgerRepository } from '../infrastructure/repositories/prisma-billing-ledger.repository';
import { PrismaPaymentAttemptRepository } from '../infrastructure/repositories/prisma-payment-attempt.repository';
import { PrismaUsageRepository } from '../infrastructure/repositories/prisma-usage.repository';
import { MockPaymentProvider } from '../infrastructure/payment/mock-payment-provider';
import { IAuditRepository } from '../application/ports/audit.repository.interface';
import { IOutboxRepository } from '../application/ports/outbox.repository.interface';
import { Decimal } from 'decimal.js';

class MockAuditRepository implements IAuditRepository {
  async log(entry: any, tx?: any): Promise<void> {}
}

class MockOutboxRepository implements IOutboxRepository {
  async publish(event: any, tx?: any): Promise<void> {}
  async publishAll(events: any[], tx?: any): Promise<void> {}
}

describe('Billing Service Integration Tests (S-23 Phase 02)', () => {
  jest.setTimeout(120000);

  let module: TestingModule;
  let prisma: PrismaService;
  let subscriptionService: SubscriptionService;
  let invoiceService: InvoiceService;
  let paymentService: PaymentService;
  let usageService: UsageService;
  
  let orgId: string;
  let workspaceId: string;
  let productId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        SubscriptionService,
        InvoiceService,
        BillingLedgerService,
        PaymentService,
        UsageService,
        { provide: 'ISubscriptionRepository', useClass: PrismaSubscriptionRepository },
        { provide: 'IInvoiceRepository', useClass: PrismaInvoiceRepository },
        { provide: 'IBillingLedgerRepository', useClass: PrismaBillingLedgerRepository },
        { provide: 'IPaymentAttemptRepository', useClass: PrismaPaymentAttemptRepository },
        { provide: 'IUsageRecordRepository', useClass: PrismaUsageRepository },
        { provide: 'PaymentProvider', useClass: MockPaymentProvider },
        { provide: 'IAuditRepository', useClass: MockAuditRepository },
        { provide: 'IOutboxRepository', useClass: MockOutboxRepository }
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    subscriptionService = module.get(SubscriptionService);
    invoiceService = module.get(InvoiceService);
    paymentService = module.get(PaymentService);
    usageService = module.get(UsageService);

    // Setup Test Tenant
    const user = await prisma.user.create({
      data: {
        email: `test-${crypto.randomUUID()}@veerox.com`,
        username: `user-${crypto.randomUUID()}`,
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hash'
      }
    });

    const org = await prisma.organization.create({
      data: {
        name: `Org ${crypto.randomUUID()}`,
        slug: `org-${crypto.randomUUID()}`,
        ownerUserId: user.id
      }
    });

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Default Workspace'
      }
    });

    orgId = org.id;
    workspaceId = workspace.id;

    const product = await prisma.marketplaceProduct.create({
      data: {
        organizationId: orgId,
        name: `Billing Test Product ${crypto.randomUUID()}`,
        productType: 'EA',
        pricingModel: 'SUBSCRIPTION',
        price: 10,
        currency: 'USD',
        status: 'ACTIVE'
      }
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Track B - Subscription Lifecycle', () => {
    let subId: string;

    it('should create a subscription', async () => {
      subId = await subscriptionService.createSubscription({
        organizationId: orgId,
        workspaceId: workspaceId,
        productId,
        billingPeriod: 'MONTHLY'
      });
      expect(subId).toBeDefined();
    });

    it('should activate a subscription', async () => {
      await subscriptionService.activateSubscription(subId, new Date(), orgId, workspaceId);
      const sub = await prisma.productSubscription.findUnique({ where: { id: subId } });
      expect(sub?.status).toBe('ACTIVE');
    });

    it('should enforce tenant isolation during cancellation', async () => {
      await expect(
        subscriptionService.cancelSubscription(subId, crypto.randomUUID(), workspaceId)
      ).rejects.toThrow('Unauthorized');
    });

    it('should reject invalid transitions (e.g. activate an active subscription)', async () => {
      await expect(
        subscriptionService.activateSubscription(subId, new Date(), orgId, workspaceId)
      ).rejects.toThrow('Invalid transition');
    });
  });

  describe('Track D & E - Invoice Lifecycle & Payment', () => {
    let invoiceId: string;

    it('should create and issue an invoice with lines', async () => {
      invoiceId = await invoiceService.createInvoice({
        organizationId: orgId,
        workspaceId: workspaceId,
        currency: 'USD'
      });

      await invoiceService.addLine(invoiceId, 'API Usage', new Decimal(150.00), orgId, workspaceId);
      await invoiceService.issueInvoice(invoiceId, orgId, workspaceId);

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.status).toBe('ISSUED');
      expect(invoice?.amount.toNumber()).toBe(150.00);
    });

    it('should successfully pay an invoice', async () => {
      const idKey = `pay-${crypto.randomUUID()}`;
      await paymentService.payInvoice(invoiceId, orgId, workspaceId, idKey);

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.status).toBe('PAID');

      // Verify ledger entry
      const ledger = await prisma.billingLedgerEntry.findFirst({
        where: { referenceId: invoiceId, transactionType: 'PAYMENT' }
      });
      expect(ledger).toBeDefined();
      expect(ledger?.amount.toNumber()).toBe(150.00);
    });

    it('should enforce idempotency for payments', async () => {
      const invId = await invoiceService.createInvoice({
        organizationId: orgId,
        workspaceId: workspaceId,
        currency: 'USD'
      });
      await invoiceService.addLine(invId, 'Idempotency Line', new Decimal(75.00), orgId, workspaceId);
      await invoiceService.issueInvoice(invId, orgId, workspaceId);

      const idKey = `pay-duplicate-${crypto.randomUUID()}`;
      await paymentService.payInvoice(invId, orgId, workspaceId, idKey);
      // Second call with same idempotency key succeeds idempotently
      await paymentService.payInvoice(invId, orgId, workspaceId, idKey);

      const inv = await prisma.invoice.findUnique({ where: { id: invId } });
      expect(inv?.status).toBe('PAID');
    });

    it('should not allow payment of already paid invoice with a different key', async () => {
      const idKey = `pay-${crypto.randomUUID()}`;
      await expect(
        paymentService.payInvoice(invoiceId, orgId, workspaceId, idKey)
      ).rejects.toThrow('Cannot pay invoice in status PAID');
    });
  });

  describe('Track F - Idempotency (Full Flow)', () => {
    it('should handle duplicate payment requests safely', async () => {
      const invId = await invoiceService.createInvoice({
        organizationId: orgId,
        workspaceId: workspaceId,
        currency: 'USD'
      });
      await invoiceService.addLine(invId, 'Subscription', new Decimal(50.00), orgId, workspaceId);
      await invoiceService.issueInvoice(invId, orgId, workspaceId);

      const idKey = `pay-idemp-${crypto.randomUUID()}`;

      // First call succeeds
      await paymentService.payInvoice(invId, orgId, workspaceId, idKey);
      
      const invAfter1 = await prisma.invoice.findUnique({ where: { id: invId } });
      expect(invAfter1?.status).toBe('PAID');

      // Second call with same idempotency key should just return without error and not double charge
      await paymentService.payInvoice(invId, orgId, workspaceId, idKey);

      const ledgerEntries = await prisma.billingLedgerEntry.findMany({
        where: { referenceId: invId }
      });
      // Should still only be 1 ledger entry
      expect(ledgerEntries.length).toBe(1);
    });
  });

  describe('Track G - Usage Metering', () => {
    it('should record usage and enforce idempotency', async () => {
      const idKey = `usage-${crypto.randomUUID()}`;
      await usageService.recordUsage({
        organizationId: orgId,
        workspaceId: workspaceId,
        metricName: 'API_CALLS',
        quantity: new Decimal(1000),
        idempotencyKey: idKey
      });

      const usage = await prisma.usageRecord.findUnique({ where: { idempotencyKey: idKey } });
      expect(usage).toBeDefined();
      expect(usage?.quantity.toNumber()).toBe(1000);

      // Duplicate should return the same usage ID due to idempotent recovery
      const duplicateId = await usageService.recordUsage({
        organizationId: orgId,
        workspaceId: workspaceId,
        metricName: 'API_CALLS',
        quantity: new Decimal(1000),
        idempotencyKey: idKey
      });
      expect(duplicateId).toBe(usage?.id);
    });
  });

  describe('Track H - Adversarial Payment Concurrency', () => {
    it('should gracefully handle massive concurrent payment attempts for the same invoice', async () => {
      const invId = await invoiceService.createInvoice({
        organizationId: orgId,
        workspaceId: workspaceId,
        currency: 'USD'
      });
      await invoiceService.addLine(invId, 'Concurrency Test', new Decimal(500.00), orgId, workspaceId);
      await invoiceService.issueInvoice(invId, orgId, workspaceId);

      // Fire 10 concurrent requests with DIFFERENT idempotency keys 
      // (simulating a double spend attack or frontend glitch)
      const attempts = Array.from({ length: 10 }).map((_, i) => {
        const idKey = `pay-adv-${crypto.randomUUID()}`;
        return paymentService.payInvoice(invId, orgId, workspaceId, idKey)
          .then(() => ({ success: true, key: idKey, error: undefined as string | undefined }))
          .catch((e) => ({ success: false, error: e.message as string, key: idKey }));
      });

      const results = await Promise.all(attempts);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Only exactly ONE should succeed
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(9);

      // The failures should be concurrency/state errors
      failed.forEach(f => {
        expect(
          f.error?.includes('already being processed') || 
          f.error?.includes('Cannot pay invoice in status') ||
          f.error?.includes('already paid')
        ).toBe(true);
      });

      // Verify the final state is cleanly PAID
      const finalInvoice = await prisma.invoice.findUnique({ where: { id: invId } });
      expect(finalInvoice?.status).toBe('PAID');

      // Verify ONLY ONE billing ledger entry exists for this payment
      const ledgerEntries = await prisma.billingLedgerEntry.findMany({
        where: { referenceId: invId, transactionType: 'PAYMENT' }
      });
      expect(ledgerEntries.length).toBe(1);
      expect(ledgerEntries[0].amount.toNumber()).toBe(500.00);

      // Verify payment attempt records
      const dbAttempts = await prisma.paymentAttempt.findMany({
        where: { invoiceId: invId }
      });
      // We should have at least 1 SUCCESS. The others might not even have been created 
      // if they failed the initial PROCESSING check.
      const successfulAttempts = dbAttempts.filter(a => a.status === 'SUCCESS');
      expect(successfulAttempts.length).toBe(1);
    });
  });
});
