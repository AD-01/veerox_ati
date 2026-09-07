import { Injectable } from '@nestjs/common';
import { IEvent } from '@nestjs/cqrs';
import { AggregateRoot } from '@nestjs/cqrs';

// Define a minimal Prisma transaction type to avoid strict coupling to the full generated client
export type PrismaTransaction = {
  outboxMessage: {
    create(data: { data: any }): Promise<any>;
    createMany(data: { data: any[] }): Promise<any>;
  };
};

export interface IEventSource {
  getUncommittedEvents(): any[];
  uncommit(): void;
}

@Injectable()
export class OutboxService {
  /**
   * Extracts uncommitted events from aggregates and saves them to the Outbox table within the provided Prisma transaction.
   * NOTE: This does NOT call `aggregate.commit()` because that would trigger local EventBus handlers immediately.
   * If local handling is still desired, the caller should commit manually or wait for the Outbox Publisher.
   * 
   * @param tx Prisma transaction client
   * @param aggregateType String identifying the aggregate root (e.g., 'PositionAggregate')
   * @param aggregateId ID of the aggregate
   * @param aggregates One or more aggregates to extract events from
   */
  async saveEvents(
    tx: PrismaTransaction,
    aggregateType: string,
    aggregateId: string,
    aggregates: IEventSource | IEventSource[],
  ): Promise<void> {
    const aggArray = Array.isArray(aggregates) ? aggregates : [aggregates];
    
    const events: IEvent[] = [];
    for (const agg of aggArray) {
      events.push(...agg.getUncommittedEvents());
      // We manually clear the events so they don't get accidentally published by a subsequent commit() 
      // if the developer mistakenly calls it.
      agg.uncommit(); 
    }

    if (events.length === 0) {
      return;
    }

    const records = events.map(event => {
      // Extract tenant and correlation data if present on the event
      const e = event as any;
      const organizationId = e.organizationId || null;
      const workspaceId = e.workspaceId || null;
      const correlationId = e.correlationId || null;
      const eventType = event.constructor.name || 'UnknownEvent';

      return {
        aggregateType,
        aggregateId,
        eventType,
        payload: JSON.parse(JSON.stringify(event)), // Serialize to JSON
        organizationId,
        workspaceId,
        correlationId,
      };
    });

    await tx.outboxMessage.createMany({
      data: records,
    });
  }
}
