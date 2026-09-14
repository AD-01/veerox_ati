/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { PurchaseCreatedEvent } from '@veerox/events';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { IOutboxRepository } from '../ports/outbox.repository.interface';
import { BillingPurchaseRequest, BillingPurchaseResponse, IBillingPurchaseBoundary } from '../ports/billing-purchase.port';

@Injectable()
export class BillingPurchaseService implements IBillingPurchaseBoundary {
  constructor(
    @Inject('ISubscriptionRepository') private readonly subscriptionRepo: ISubscriptionRepository,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    @Inject('IOutboxRepository') private readonly outboxRepo: IOutboxRepository,
    private readonly prisma: PrismaService
  ) {}

  async purchase(request: BillingPurchaseRequest): Promise<BillingPurchaseResponse> {
    try {
      return await this.prisma.$transaction(async tx => {
        const workspace = await tx.workspace.findUnique({
          where: { id: request.workspaceId },
          select: { organizationId: true }
        });
        if (!workspace || workspace.organizationId !== request.organizationId) {
          throw new Error('Workspace does not belong to organization');
        }

        const product = await tx.marketplaceProduct.findUnique({
          where: { id: request.productId },
          select: { id: true, name: true, price: true, currency: true, status: true }
        });
        if (!product) throw new Error('Product not found');
        if (product.status !== 'ACTIVE') {
          throw new Error(`Product is not available for purchase (status: ${product.status})`);
        }

        await tx.idempotentCommand.create({
          data: {
            idempotencyKey: request.idempotencyKey,
            commandName: 'BillingPurchase',
            organizationId: request.organizationId,
            workspaceId: request.workspaceId,
          }
        });

        const subscription = Subscription.create({
          id: randomUUID(),
          organizationId: request.organizationId,
          workspaceId: request.workspaceId,
          productId: request.productId,
          billingPeriod: 'MONTHLY',
          idempotencyKey: request.idempotencyKey
        });
        subscription.activate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), request.correlationId);
        await this.subscriptionRepo.save(subscription, tx);

        const invoice = Invoice.create({
          id: randomUUID(),
          organizationId: request.organizationId,
          workspaceId: request.workspaceId,
          subscriptionId: subscription.id,
          currency: product.currency,
          idempotencyKey: `${request.idempotencyKey}:invoice`
        });
        invoice.addLine(randomUUID(), product.name, new Decimal(product.price));
        invoice.issue();
        await this.invoiceRepo.save(invoice, tx);

        const purchaseEvent = new PurchaseCreatedEvent(
          randomUUID(),
          request.organizationId,
          request.workspaceId,
          request.productId,
          Number(product.price),
          product.currency,
          subscription.id,
          request.correlationId,
          undefined,
          request.idempotencyKey
        );

        await this.outboxRepo.publishAll([
          purchaseEvent,
          ...subscription.getUncommittedEvents(),
          ...invoice.getUncommittedEvents()
        ], tx);

        await this.auditRepo.log({
          action: 'PURCHASE_CREATED',
          organizationId: request.organizationId,
          workspaceId: request.workspaceId,
          targetEntityId: subscription.id,
          targetEntityType: 'PURCHASE',
          newState: JSON.stringify({ productId: request.productId, subscriptionId: subscription.id, invoiceId: invoice.id }),
          correlationId: request.correlationId
        }, tx);

        await this.auditRepo.log({
          action: 'INVOICE_ISSUED',
          organizationId: request.organizationId,
          workspaceId: request.workspaceId,
          targetEntityId: invoice.id,
          targetEntityType: 'INVOICE',
          newState: JSON.stringify({ status: invoice.status, amount: invoice.amount.toString() }),
          correlationId: request.correlationId
        }, tx);

        subscription.commit();
        invoice.commit();
        return {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          status: subscription.status,
          correlationId: request.correlationId
        };
      }, { maxWait: 20000, timeout: 30000 });
    } catch (error: any) {
      if (error.code === 'P2002' && request.idempotencyKey) {
        const subscription = await this.prisma.productSubscription.findUnique({
          where: { idempotencyKey: request.idempotencyKey }
        });
        if (subscription) {
          const invoice = await this.prisma.invoice.findFirst({ where: { subscriptionId: subscription.id } });
          if (invoice) {
            return {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              status: subscription.status,
              correlationId: request.correlationId
            };
          }
        }
      }
      throw error;
    }
  }
}
