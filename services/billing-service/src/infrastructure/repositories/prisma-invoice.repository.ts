import { Injectable } from '@nestjs/common';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { Invoice, InvoiceLine } from '../../domain/aggregates/invoice.aggregate';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';
import { Decimal } from 'decimal.js';

@Injectable()
export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Invoice | null> {
    const client = tx || this.prisma;
    const record = await client.invoice.findUnique({
      where: { id },
      include: { lines: true }
    });
    if (!record) return null;

    return Invoice.restore({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      subscriptionId: record.subscriptionId,
      amount: new Decimal(record.amount.toString()),
      currency: record.currency,
      status: record.status,
      issuedAt: record.issuedAt || new Date(),
      paidAt: record.paidAt || null,
      idempotencyKey: record.idempotencyKey,
      lines: record.lines.map(l => new InvoiceLine(l.id, l.description, new Decimal(l.amount.toString())))
    });
  }

  async save(invoice: Invoice, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    const data = {
      organizationId: invoice.organizationId,
      workspaceId: invoice.workspaceId,
      subscriptionId: invoice.subscriptionId,
      amount: new Prisma.Decimal(invoice.amount.toString()),
      currency: invoice.currency,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      idempotencyKey: invoice.idempotencyKey,
    };

    await client.invoice.upsert({
      where: { id: invoice.id },
      update: data,
      create: {
        id: invoice.id,
        ...data,
      },
    });

    // Handle lines - delete existing and recreate
    await client.invoiceLine.deleteMany({
      where: { invoiceId: invoice.id }
    });

    if (invoice.lines.length > 0) {
      await client.invoiceLine.createMany({
        data: invoice.lines.map(line => ({
          id: line.id,
          invoiceId: invoice.id,
          description: line.description,
          amount: new Prisma.Decimal(line.amount.toString())
        }))
      });
    }
  }
}
