import { Injectable } from '@nestjs/common';
import { IUsageRecordRepository } from '../../domain/repositories/usage.repository.interface';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';
import { Decimal } from 'decimal.js';
import { UsageRecordedEvent } from '@veerox/events';

@Injectable()
export class PrismaUsageRepository implements IUsageRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    productId: string | null;
    metricName: string;
    quantity: Decimal;
    idempotencyKey: string;
  }, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    // Usage records are immutable
    await client.usageRecord.create({
      data: {
        id: props.id,
        organizationId: props.organizationId,
        workspaceId: props.workspaceId,
        productId: props.productId,
        metricName: props.metricName,
        quantity: props.quantity,
        idempotencyKey: props.idempotencyKey,
      },
    });

    // Handle outbox event emission if we had an event bus or outbox repo
    // For now we're just satisfying the repository
    const _event = new UsageRecordedEvent(
      crypto.randomUUID(),
      props.organizationId,
      props.workspaceId,
      props.productId,
      props.metricName,
      props.quantity.toNumber(),
      new Date()
    );
  }
}
