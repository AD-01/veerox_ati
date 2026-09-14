import { Injectable, Inject } from '@nestjs/common';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { IOutboxRepository } from '../ports/outbox.repository.interface';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { PrismaService } from '@veerox/database';
import { Decimal } from 'decimal.js';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    @Inject('IOutboxRepository') private readonly outboxRepo: IOutboxRepository,
    private readonly prisma: PrismaService
  ) {}

  async createInvoice(props: {
    organizationId: string;
    workspaceId: string;
    subscriptionId?: string;
    currency: string;
    idempotencyKey?: string;
  }): Promise<string> {
    const invoiceId = crypto.randomUUID();

    try {
      await this.prisma.$transaction(async (tx) => {
        if (props.idempotencyKey) {
          // CRITICAL: Store the invoice ID with the idempotency key for recovery
          await tx.idempotentCommand.create({
            data: {
              idempotencyKey: props.idempotencyKey,
              commandName: 'CreateInvoice',
              organizationId: props.organizationId,
              workspaceId: props.workspaceId,
              resultId: invoiceId  // Store invoice ID for recovery on collision
            }
          });
        }

        const invoice = Invoice.create({
          id: invoiceId,
          ...props,
          subscriptionId: props.subscriptionId || null
        });

        await this.invoiceRepo.save(invoice, tx);
        await this.outboxRepo.publishAll(invoice.getUncommittedEvents(), tx);

        await this.auditRepo.log({
          action: 'INVOICE_CREATED',
          organizationId: props.organizationId,
          workspaceId: props.workspaceId,
          targetEntityId: invoiceId,
          targetEntityType: 'INVOICE',
          newState: JSON.stringify({ status: invoice.status, currency: invoice.currency })
        }, tx);
      });
    } catch (error: any) {
      if (error.code === 'P2002' && props.idempotencyKey) {
        // CRITICAL FIX: Recover the original invoice ID from idempotent command
        const existing = await this.prisma.idempotentCommand.findUnique({
          where: { idempotencyKey: props.idempotencyKey }
        });
        
        if (existing && existing.resultId) {
          // Idempotent return - use the stored invoice ID
          return existing.resultId;
        }
        
        // If we can't find the result ID (shouldn't happen), this is a fatal error
        throw new Error('Invoice idempotency collision detected but result ID not recoverable');
      }
      throw error;
    }

    return invoiceId;
  }

  async addLine(invoiceId: string, description: string, amount: Decimal, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceRepo.findById(invoiceId, tx);
      if (!invoice) throw new Error('Invoice not found');

      if (invoice.organizationId !== organizationId || invoice.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      invoice.addLine(crypto.randomUUID(), description, amount);

      await this.invoiceRepo.save(invoice, tx);
      await this.outboxRepo.publishAll(invoice.getUncommittedEvents(), tx);
    });
  }

  async issueInvoice(invoiceId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceRepo.findById(invoiceId, tx);
      if (!invoice) throw new Error('Invoice not found');

      if (invoice.organizationId !== organizationId || invoice.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      const prevState = invoice.status;
      invoice.issue();

      await this.invoiceRepo.save(invoice, tx);
      await this.outboxRepo.publishAll(invoice.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'INVOICE_ISSUED',
        organizationId,
        workspaceId,
        targetEntityId: invoiceId,
        targetEntityType: 'INVOICE',
        previousState: JSON.stringify({ status: prevState }),
        newState: JSON.stringify({ status: invoice.status, amount: invoice.amount.toString() })
      }, tx);
    });
  }

  async voidInvoice(invoiceId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceRepo.findById(invoiceId, tx);
      if (!invoice) throw new Error('Invoice not found');

      if (invoice.organizationId !== organizationId || invoice.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      const prevState = invoice.status;
      invoice.void();

      await this.invoiceRepo.save(invoice, tx);
      await this.outboxRepo.publishAll(invoice.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'INVOICE_VOIDED',
        organizationId,
        workspaceId,
        targetEntityId: invoiceId,
        targetEntityType: 'INVOICE',
        previousState: JSON.stringify({ status: prevState }),
        newState: JSON.stringify({ status: invoice.status })
      }, tx);
    });
  }
}
