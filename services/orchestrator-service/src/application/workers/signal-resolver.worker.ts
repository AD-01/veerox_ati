import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { SignalOrchestratedEvent, SignalConflictDetectedEvent } from '@veerox/events';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SignalResolverWorker {
  private readonly logger = new Logger(SignalResolverWorker.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.resolvePendingIntents();
    } catch (error) {
      this.logger.error('Error resolving signal intents', error);
    } finally {
      this.isRunning = false;
    }
  }

  async resolvePendingIntents() {
    const pendingIntents = await this.prisma.signalIntent.findMany({
      where: { status: 'PENDING' },
      take: 100,
    });

    if (!pendingIntents.length) return;

    // Atomically claim rows
    const claimedIntents = [];
    for (const intent of pendingIntents) {
      try {
        const updated = await this.prisma.signalIntent.update({
          where: { id: intent.id, status: 'PENDING' },
          data: { status: 'PROCESSING' }
        });
        claimedIntents.push(updated);
      } catch {
        // RecordNotFound means another worker claimed it or it was deleted. Safely ignore.
      }
    }

    if (!claimedIntents.length) return;

    // Group by workspace, symbol, and timeWindow
    const grouped = new Map<string, typeof pendingIntents>();

    for (const intent of claimedIntents) {
      const key = `${intent.workspaceId}_${intent.symbolId}_${intent.timeWindow.toISOString()}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(intent);
    }

    for (const [key, intents] of grouped.entries()) {
      if (intents.length === 1) {
        // No conflict, resolve and dispatch
        const intent = intents[0];
        
        await this.prisma.$transaction(async (tx) => {
          await tx.signalIntent.update({
            where: { id: intent.id },
            data: { status: 'RESOLVED' },
          });

          const event = new SignalOrchestratedEvent(
            intent.id,
            intent.organizationId,
            intent.workspaceId,
            intent.correlationId,
            intent.symbolId,
            intent.source as 'AI' | 'STRATEGY',
            intent.sourceId,
            intent.direction as 'BUY' | 'SELL',
            intent.size ? Number(intent.size) : null,
            new Date(),
          );

          await tx.outboxMessage.create({
            data: {
              aggregateType: 'SignalOrchestrator',
              aggregateId: intent.id,
              eventType: 'SignalOrchestratedEvent',
              payload: JSON.parse(JSON.stringify(event)),
              status: 'PENDING',
              correlationId: intent.correlationId,
            },
          });
        });
        
        this.logger.log(`Resolved signal intent ${intent.id} without conflict`);
      } else {
        // Conflict detected. Fail closed safely.
        await this.prisma.$transaction(async (tx) => {
          const ids = intents.map(i => i.id);
          await tx.signalIntent.updateMany({
            where: { id: { in: ids } },
            data: { 
              status: 'CONFLICT_REQUIRES_RESOLUTION',
              resolutionReason: 'Multiple intents detected in the same time window without an authoritative priority rule',
            },
          });

          const event = new SignalConflictDetectedEvent(
            intents[0].symbolId,
            intents[0].timeWindow,
            intents.map(i => ({ id: i.id, source: i.source, direction: i.direction })),
            'Multiple intents detected in the same time window',
            new Date(),
          );

          await tx.outboxMessage.create({
            data: {
              aggregateType: 'SignalOrchestrator',
              aggregateId: uuidv4(),
              eventType: 'SignalConflictDetectedEvent',
              payload: JSON.parse(JSON.stringify(event)),
              status: 'PENDING',
              correlationId: intents[0].correlationId,
            },
          });
        });
        
        this.logger.warn(`Detected conflict for key ${key}. Intents marked for manual resolution.`);
      }
    }
  }
}
