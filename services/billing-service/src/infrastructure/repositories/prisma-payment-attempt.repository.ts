import { Injectable } from '@nestjs/common';
import { IPaymentAttemptRepository } from '../../domain/repositories/payment-attempt.repository.interface';
import { PaymentAttempt } from '../../domain/aggregates/payment-attempt.aggregate';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';
import { Decimal } from 'decimal.js';

@Injectable()
export class PrismaPaymentAttemptRepository implements IPaymentAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(key: string, tx?: Prisma.TransactionClient): Promise<PaymentAttempt | null> {
    const client = tx || this.prisma;
    const record = await client.paymentAttempt.findUnique({ where: { idempotencyKey: key } });
    if (!record) return null;

    return PaymentAttempt.restore({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      invoiceId: record.invoiceId,
      provider: record.provider,
      providerPaymentId: record.providerPaymentId,
      amount: new Decimal(record.amount.toString()),
      currency: record.currency,
      status: record.status,
      errorMessage: record.errorMessage,
      idempotencyKey: record.idempotencyKey
    });
  }

  async save(attempt: PaymentAttempt, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    const data = {
      organizationId: attempt.organizationId,
      workspaceId: attempt.workspaceId,
      invoiceId: attempt.invoiceId,
      provider: attempt.provider,
      providerPaymentId: attempt.providerPaymentId,
      amount: new Prisma.Decimal(attempt.amount.toString()),
      currency: attempt.currency,
      status: attempt.status,
      errorMessage: attempt.errorMessage,
      idempotencyKey: attempt.idempotencyKey
    };

    await client.paymentAttempt.upsert({
      where: { idempotencyKey: attempt.idempotencyKey },
      update: data,
      create: {
        id: attempt.id,
        ...data,
      },
    });

    attempt.commit();
  }
}
