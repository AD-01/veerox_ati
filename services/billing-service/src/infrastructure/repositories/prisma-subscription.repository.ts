import { Injectable } from '@nestjs/common';
import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { Subscription, SubscriptionStatus } from '../../domain/aggregates/subscription.aggregate';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';

@Injectable()
export class PrismaSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Subscription | null> {
    const client = tx || this.prisma;
    const record = await client.productSubscription.findUnique({ where: { id } });
    if (!record) return null;

    return Subscription.restore({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      productId: record.productId,
      status: record.status as SubscriptionStatus,
      billingPeriod: record.billingPeriod,
      nextBillingDate: record.nextBillingDate,
      idempotencyKey: record.idempotencyKey
    });
  }

  async save(subscription: Subscription, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    const data = {
      organizationId: subscription.organizationId,
      workspaceId: subscription.workspaceId,
      productId: subscription.productId,
      status: subscription.status,
      billingPeriod: subscription.billingPeriod,
      nextBillingDate: subscription.nextBillingDate || new Date(Date.now() + 30*86400000),
      idempotencyKey: subscription.idempotencyKey || 'generated-' + crypto.randomUUID() // Default if missing
    };

    await client.productSubscription.upsert({
      where: { id: subscription.id },
      update: data,
      create: {
        id: subscription.id,
        ...data,
      },
    });
  }
}
