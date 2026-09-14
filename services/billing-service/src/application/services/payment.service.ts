import { Injectable, Inject } from '@nestjs/common';
import { IPaymentAttemptRepository } from '../../domain/repositories/payment-attempt.repository.interface';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { PaymentProvider } from '../../domain/services/payment-provider.interface';
import { PaymentAttempt } from '../../domain/aggregates/payment-attempt.aggregate';
import { BillingLedgerService } from './billing-ledger.service';
import { TransactionType } from '../../domain/aggregates/billing-ledger.aggregate';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { IOutboxRepository } from '../ports/outbox.repository.interface';
import { PrismaService } from '@veerox/database';

@Injectable()
export class PaymentService {
  constructor(
    @Inject('IPaymentAttemptRepository') private readonly paymentAttemptRepo: IPaymentAttemptRepository,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('PaymentProvider') private readonly paymentProvider: PaymentProvider,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    @Inject('IOutboxRepository') private readonly outboxRepo: IOutboxRepository,
    private readonly billingLedgerService: BillingLedgerService,
    private readonly prisma: PrismaService
  ) {}

  async payInvoice(
    invoiceId: string,
    organizationId: string,
    workspaceId: string,
    idempotencyKey: string
  ): Promise<void> {
    // CRITICAL FIX: Lock the invoice and transition to PROCESSING *before* calling the provider
    // This prevents concurrent requests from double-charging the customer.
    let attemptId = '';
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;
      
      const txInvoice = await this.invoiceRepo.findById(invoiceId, tx);
      if (!txInvoice) throw new Error('Invoice not found');
      if (txInvoice.organizationId !== organizationId || txInvoice.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      // Check existing attempt
      const existingAttempt = await this.paymentAttemptRepo.findByIdempotencyKey(idempotencyKey, tx);
      if (existingAttempt) {
        if (existingAttempt.status === 'SUCCESS') {
          return; // Already paid
        }
        if (existingAttempt.status === 'FAILED') {
          throw new Error('Payment previously failed with this idempotency key');
        }
      }

      if (txInvoice.status === 'PROCESSING') {
        if (!existingAttempt) {
          throw new Error('Invoice is already being processed by another payment attempt');
        }
      } else if (txInvoice.status !== 'ISSUED' && txInvoice.status !== 'PAST_DUE') {
        throw new Error(`Cannot pay invoice in status ${txInvoice.status}`);
      }

      if (txInvoice.status !== 'PROCESSING') {
        txInvoice.markAsProcessing();
        await this.invoiceRepo.save(txInvoice, tx);
      }

      let attempt = existingAttempt;
      if (!attempt) {
        attempt = PaymentAttempt.create({
          id: crypto.randomUUID(),
          organizationId,
          workspaceId,
          invoiceId,
          provider: 'MOCK',
          amount: txInvoice.amount,
          currency: txInvoice.currency,
          idempotencyKey
        });
        await this.paymentAttemptRepo.save(attempt, tx);
        
        await this.auditRepo.log({
          action: 'PAYMENT_ATTEMPTED',
          organizationId,
          workspaceId,
          targetEntityId: attempt.id,
          targetEntityType: 'PAYMENT_ATTEMPT',
          newState: JSON.stringify({ invoiceId, amount: attempt.amount.toString(), idempotencyKey })
        }, tx);
      }
      attemptId = attempt.id;
    });

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found'); // Should not happen

    // CRITICAL: Call external provider WITHOUT changing status first
    // If the process crashes after this point but before transaction commit,
    // the next retry will find PENDING attempt and retry the provider call
    // Provider MUST be idempotent with the idempotencyKey
    let result;
    try {
      result = await this.paymentProvider.createPayment(
        invoice.amount,
        invoice.currency,
        idempotencyKey
      );
    } catch (error: any) {
      // If the provider fails with a network error, revert the invoice to ISSUED so it can be retried
      await this.prisma.$transaction(async (tx) => {
         await tx.$executeRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;
         const txInvoice = await this.invoiceRepo.findById(invoiceId, tx);
         if (txInvoice && txInvoice.status === 'PROCESSING') {
           txInvoice.revertProcessing();
           await this.invoiceRepo.save(txInvoice, tx);
         }
      });
      throw new Error(`Provider integration failure: ${error.message}`);
    }

    // Handle provider result atomically with all side effects
    await this.prisma.$transaction(async (tx) => {
      // Lock the invoice row to prevent concurrent settlements (double spend prevention)
      await tx.$executeRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;

      const txAttempt = await this.paymentAttemptRepo.findByIdempotencyKey(idempotencyKey, tx);
      const txInvoice = await this.invoiceRepo.findById(invoiceId, tx);
      
      if (!txAttempt || !txInvoice) throw new Error('Concurrency Error');
      
      // If already settled or paid by another transaction, idempotent return / abort
      if (txAttempt.status === 'SUCCESS' || txAttempt.status === 'FAILED') return;
      if (txInvoice.status === 'PAID') {
        // Invoice was paid concurrently by another transaction with a different idempotency key!
        txAttempt.markAsFailed('Invoice already paid by another transaction');
        await this.paymentAttemptRepo.save(txAttempt, tx);
        
        await this.auditRepo.log({
          action: 'PAYMENT_FAILED_DUPLICATE',
          organizationId,
          workspaceId,
          targetEntityId: txAttempt.id,
          targetEntityType: 'PAYMENT_ATTEMPT',
          newState: JSON.stringify({ errorMessage: 'Invoice already paid' })
        }, tx);
        
        // At this point we might need to issue an async refund for the provider charge.
        // For the mock provider, marking as failed prevents double ledger entries.
        throw new Error('Invoice already paid. Duplicate payment attempt aborted.');
      }

      if (result.success && result.providerPaymentId) {
        // Provider succeeded - transition to SUCCESS atomically
        txAttempt.markAsSuccess(result.providerPaymentId);
        txInvoice.markAsPaid(result.providerPaymentId);

        await this.paymentAttemptRepo.save(txAttempt, tx);
        await this.invoiceRepo.save(txInvoice, tx);

        // Record on Billing Ledger - use same idempotency principle for ledger
        await this.billingLedgerService.recordTransaction({
          organizationId,
          workspaceId,
          amount: txInvoice.amount,
          currency: txInvoice.currency,
          transactionType: TransactionType.PAYMENT,
          description: `Payment for Invoice ${invoiceId}`,
          idempotencyKey: `ledger_${idempotencyKey}`,
          referenceId: invoiceId,
          referenceType: 'INVOICE'
        }, tx);

        await this.outboxRepo.publishAll(txInvoice.getUncommittedEvents(), tx);

        await this.auditRepo.log({
          action: 'PAYMENT_SUCCEEDED',
          organizationId,
          workspaceId,
          targetEntityId: txAttempt.id,
          targetEntityType: 'PAYMENT_ATTEMPT',
          newState: JSON.stringify({ providerPaymentId: result.providerPaymentId })
        }, tx);
      } else {
        // Provider rejected - transition to FAILED atomically
        txAttempt.markAsFailed(result.errorMessage || 'Unknown error');
        await this.paymentAttemptRepo.save(txAttempt, tx);

        await this.auditRepo.log({
          action: 'PAYMENT_FAILED',
          organizationId,
          workspaceId,
          targetEntityId: txAttempt.id,
          targetEntityType: 'PAYMENT_ATTEMPT',
          newState: JSON.stringify({ errorMessage: result.errorMessage })
        }, tx);
        
        throw new Error(`Payment failed: ${result.errorMessage}`);
      }
    });
  }
}
