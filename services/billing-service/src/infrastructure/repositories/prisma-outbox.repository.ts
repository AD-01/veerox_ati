import { Injectable } from '@nestjs/common';
import { DomainEvent } from '@veerox/events';
import { Prisma, PrismaService } from '@veerox/database';
import { IOutboxRepository } from '../../application/ports/outbox.repository.interface';

@Injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async publish(event: DomainEvent, tx?: Prisma.TransactionClient): Promise<void> {
    await this.publishAll([event], tx);
  }

  async publishAll(events: DomainEvent[], tx?: Prisma.TransactionClient): Promise<void> {
    if (events.length === 0) return;
    const client = tx || this.prisma;
    await client.outboxMessage.createMany({
      data: events.map(event => {
        const fields = event as unknown as Record<string, unknown>;
        const eventType = event.constructor.name;
        const aggregateId = [fields.subscriptionId, fields.invoiceId, fields.id].find(value => typeof value === 'string') as string;
        return {
          aggregateType: eventType,
          aggregateId,
          eventType,
          payload: JSON.parse(JSON.stringify(event)),
          idempotencyKey: `${eventType}:${String(fields.id)}`,
          organizationId: typeof fields.organizationId === 'string' ? fields.organizationId : null,
          workspaceId: typeof fields.workspaceId === 'string' ? fields.workspaceId : null,
          correlationId: typeof fields.correlationId === 'string' ? fields.correlationId : null
        };
      })
    });
  }
}
