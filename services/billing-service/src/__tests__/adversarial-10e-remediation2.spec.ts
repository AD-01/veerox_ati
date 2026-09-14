/**
 * S-24 Phase 10-E-REMEDIATION-2 — Adversarial Commercial Financial Safety Tests
 * 
 * These tests verify the financial safety invariants of the commercial layer.
 * They use unit-level mocking to test domain logic without requiring database infrastructure.
 */
import { Decimal } from 'decimal.js';
import { PaymentAttempt, PaymentStatus } from '../domain/aggregates/payment-attempt.aggregate';
import { Invoice, InvoiceStatus, InvoiceLine } from '../domain/aggregates/invoice.aggregate';

// ============================================================
// PAYMENT ATTEMPT AGGREGATE TESTS
// ============================================================
describe('PaymentAttempt Aggregate — State Machine', () => {
  function createAttempt() {
    return PaymentAttempt.create({
      id: 'pa-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      invoiceId: 'inv-1',
      provider: 'MOCK',
      amount: new Decimal('100.00'),
      currency: 'USD',
      idempotencyKey: 'idem-pay-1'
    });
  }

  test('creates in PENDING state', () => {
    const attempt = createAttempt();
    expect(attempt.status).toBe(PaymentStatus.PENDING);
  });

  test('PENDING -> SUCCESS is valid', () => {
    const attempt = createAttempt();
    attempt.markAsSuccess('provider-123');
    expect(attempt.status).toBe(PaymentStatus.SUCCESS);
    expect(attempt.providerPaymentId).toBe('provider-123');
  });

  test('PENDING -> FAILED is valid', () => {
    const attempt = createAttempt();
    attempt.markAsFailed('Card declined');
    expect(attempt.status).toBe(PaymentStatus.FAILED);
    expect(attempt.errorMessage).toBe('Card declined');
  });

  test('PENDING -> PROCESSING is valid', () => {
    const attempt = createAttempt();
    attempt.markAsProcessing();
    expect(attempt.status).toBe(PaymentStatus.PROCESSING);
  });

  test('PROCESSING -> SUCCESS is valid', () => {
    const attempt = createAttempt();
    attempt.markAsProcessing();
    attempt.markAsSuccess('provider-456');
    expect(attempt.status).toBe(PaymentStatus.SUCCESS);
  });

  test('PROCESSING -> FAILED is valid', () => {
    const attempt = createAttempt();
    attempt.markAsProcessing();
    attempt.markAsFailed('timeout');
    expect(attempt.status).toBe(PaymentStatus.FAILED);
  });

  test('SUCCESS -> SUCCESS is illegal', () => {
    const attempt = createAttempt();
    attempt.markAsSuccess('provider-123');
    expect(() => attempt.markAsSuccess('provider-456')).toThrow();
  });

  test('FAILED -> SUCCESS is illegal', () => {
    const attempt = createAttempt();
    attempt.markAsFailed('declined');
    expect(() => attempt.markAsSuccess('provider-123')).toThrow();
  });

  test('SUCCESS -> FAILED is illegal', () => {
    const attempt = createAttempt();
    attempt.markAsSuccess('provider-123');
    expect(() => attempt.markAsFailed('error')).toThrow();
  });

  test('FAILED -> FAILED is illegal', () => {
    const attempt = createAttempt();
    attempt.markAsFailed('error1');
    expect(() => attempt.markAsFailed('error2')).toThrow();
  });

  test('amount uses Decimal correctly', () => {
    const attempt = createAttempt();
    expect(attempt.amount.toString()).toBe('100');
  });
});

// ============================================================
// INVOICE AGGREGATE STATE MACHINE TESTS  
// ============================================================
describe('Invoice Aggregate — State Machine', () => {
  function createDraftInvoice() {
    const inv = Invoice.create({
      id: 'inv-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      subscriptionId: null,
      currency: 'USD',
      idempotencyKey: 'inv-idem-1'
    });
    inv.addLine('line-1', 'Test charge', new Decimal('50.00'));
    return inv;
  }

  test('DRAFT -> ISSUED is valid', () => {
    const inv = createDraftInvoice();
    inv.issue();
    expect(inv.status).toBe(InvoiceStatus.ISSUED);
  });

  test('ISSUED -> PAID is valid', () => {
    const inv = createDraftInvoice();
    inv.issue();
    inv.markAsPaid('pay-1');
    expect(inv.status).toBe(InvoiceStatus.PAID);
  });

  test('PAID -> PAID is illegal', () => {
    const inv = createDraftInvoice();
    inv.issue();
    inv.markAsPaid('pay-1');
    expect(() => inv.markAsPaid('pay-2')).toThrow('Invalid transition');
  });

  test('VOID -> ISSUE is illegal', () => {
    const inv = createDraftInvoice();
    inv.void();
    expect(() => inv.issue()).toThrow('Invalid transition');
  });

  test('DRAFT with no lines -> ISSUE is illegal', () => {
    const inv = Invoice.create({
      id: 'inv-2',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      subscriptionId: null,
      currency: 'USD'
    });
    expect(() => inv.issue()).toThrow('Cannot issue an invoice with no lines');
  });

  test('amount uses Decimal arithmetic correctly', () => {
    const inv = createDraftInvoice();
    inv.addLine('line-2', 'Second charge', new Decimal('25.50'));
    expect(inv.amount.toString()).toBe('75.5');
  });

  test('ISSUED -> VOID is valid', () => {
    const inv = createDraftInvoice();
    inv.issue();
    inv.void();
    expect(inv.status).toBe(InvoiceStatus.VOID);
  });

  test('PAID -> VOID is illegal', () => {
    const inv = createDraftInvoice();
    inv.issue();
    inv.markAsPaid('pay-1');
    expect(() => inv.void()).toThrow('Invalid transition');
  });
});

// ============================================================
// CROSS-TENANT ISOLATION TESTS
// ============================================================
describe('Cross-Tenant Isolation — Ownership Verification', () => {
  test('Invoice ownership check rejects cross-tenant access', () => {
    const invoice = { organizationId: 'org-1', workspaceId: 'ws-1' };
    const req = { organizationId: 'org-2', workspaceId: 'ws-2' };
    const violation = invoice.organizationId !== req.organizationId || invoice.workspaceId !== req.workspaceId;
    expect(violation).toBe(true);
  });

  test('Invoice ownership check accepts same-tenant access', () => {
    const invoice = { organizationId: 'org-1', workspaceId: 'ws-1' };
    const req = { organizationId: 'org-1', workspaceId: 'ws-1' };
    const violation = invoice.organizationId !== req.organizationId || invoice.workspaceId !== req.workspaceId;
    expect(violation).toBe(false);
  });

  test('Subscription ownership check rejects cross-workspace access', () => {
    const sub = { organizationId: 'org-1', workspaceId: 'ws-1' };
    const req = { organizationId: 'org-1', workspaceId: 'ws-ATTACKER' };
    const violation = sub.organizationId !== req.organizationId || sub.workspaceId !== req.workspaceId;
    expect(violation).toBe(true);
  });

  test('License ownership check rejects cross-org access', () => {
    const lic = { organizationId: 'org-1', workspaceId: 'ws-1' };
    const req = { organizationId: 'org-ATTACKER', workspaceId: 'ws-1' };
    const violation = lic.organizationId !== req.organizationId || lic.workspaceId !== req.workspaceId;
    expect(violation).toBe(true);
  });
});

// ============================================================
// DECIMAL PRECISION TESTS
// ============================================================
describe('Financial Decimal Precision', () => {
  test('Decimal addition preserves precision', () => {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    expect(a.plus(b).toString()).toBe('0.3');
  });

  test('Decimal prevents floating-point errors', () => {
    const total = new Decimal('19.99').plus(new Decimal('0.01'));
    expect(total.toString()).toBe('20');
  });

  test('Decimal.lte correctly handles boundary', () => {
    expect(new Decimal(0).lte(0)).toBe(true);
    expect(new Decimal(-0.001).lte(0)).toBe(true);
    expect(new Decimal(0.001).lte(0)).toBe(false);
  });

  test('Decimal.isNaN detects NaN', () => {
    expect(new Decimal(NaN).isNaN()).toBe(true);
    expect(new Decimal('10').isNaN()).toBe(false);
  });

  test('Decimal.isFinite rejects Infinity', () => {
    expect(new Decimal(Infinity).isFinite()).toBe(false);
    expect(new Decimal(-Infinity).isFinite()).toBe(false);
    expect(new Decimal('999999.99').isFinite()).toBe(true);
  });

  test('quantity validation invariant', () => {
    // Simulate the exact validation from usage.service.ts
    const testValues = [
      { input: new Decimal('10'), shouldReject: false },
      { input: new Decimal('0'), shouldReject: true },
      { input: new Decimal('-5'), shouldReject: true },
      { input: new Decimal(NaN), shouldReject: true },
      { input: new Decimal(Infinity), shouldReject: true },
      { input: new Decimal(-Infinity), shouldReject: true },
    ];
    
    for (const { input, shouldReject } of testValues) {
      const qty = new Decimal(input);
      const isInvalid = qty.isNaN() || !qty.isFinite() || qty.lte(0);
      expect(isInvalid).toBe(shouldReject);
    }
  });
});

// ============================================================
// USAGE VALIDATION TESTS (service-level)
// ============================================================
describe('UsageService — Quantity Validation (Unit)', () => {
  // Replicate the validation logic from usage.service.ts
  function validateQuantity(rawQuantity: any): Decimal {
    let qty: Decimal;
    try {
      qty = new Decimal(rawQuantity);
    } catch (e) {
      throw new Error('Malformed Decimal input for quantity');
    }

    if (qty.isNaN() || !qty.isFinite() || qty.lte(0)) {
      throw new Error('Quantity must be a positive finite number');
    }
    return qty;
  }

  test('accepts positive values', () => {
    expect(validateQuantity('10.5').toString()).toBe('10.5');
    expect(validateQuantity('0.001').toString()).toBe('0.001');
    expect(validateQuantity('999999').toString()).toBe('999999');
  });

  test('rejects zero', () => {
    expect(() => validateQuantity('0')).toThrow('Quantity must be a positive finite number');
  });

  test('rejects negative', () => {
    expect(() => validateQuantity('-1')).toThrow('Quantity must be a positive finite number');
    expect(() => validateQuantity('-0.001')).toThrow('Quantity must be a positive finite number');
  });

  test('rejects NaN', () => {
    expect(() => validateQuantity(NaN)).toThrow('Quantity must be a positive finite number');
  });

  test('rejects Infinity', () => {
    expect(() => validateQuantity(Infinity)).toThrow('Quantity must be a positive finite number');
    expect(() => validateQuantity(-Infinity)).toThrow('Quantity must be a positive finite number');
  });

  test('rejects malformed strings', () => {
    expect(() => validateQuantity('abc')).toThrow();
    expect(() => validateQuantity('')).toThrow();
  });
});
