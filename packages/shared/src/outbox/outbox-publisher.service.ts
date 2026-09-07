import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@veerox/database';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly instanceId = randomUUID();
  private readonly MAX_RETRIES = 5;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('OUTBOX_RABBITMQ_CLIENT') private readonly clientProxy: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents() {
    try {
      // 1. Atomic Claim
      const claimedMessages = await this.claimMessages(50);
      
      if (claimedMessages.length === 0) {
        return;
      }

      this.logger.debug(`Instance ${this.instanceId} claimed ${claimedMessages.length} messages.`);

      // 2. Publish Messages
      for (const message of claimedMessages) {
        await this.processMessage(message);
      }
    } catch (error) {
      this.logger.error('Error during outbox publish cycle', error);
    }
  }

  private async claimMessages(limit: number): Promise<any[]> {
    // We use Prisma $queryRaw to perform an atomic UPDATE ... RETURNING
    // SKIP LOCKED ensures concurrent pollers don't block each other.
    const messages = await this.prisma.$queryRaw<any[]>`
      UPDATE "outbox_messages"
      SET "status" = 'PROCESSING',
          "locked_until" = NOW() + INTERVAL '30 seconds',
          "locked_by" = ${this.instanceId},
          "updated_at" = NOW()
      WHERE id IN (
        SELECT id FROM "outbox_messages"
        WHERE ("status" = 'PENDING' AND "locked_until" IS NULL)
           OR ("status" = 'PROCESSING' AND "locked_until" < NOW())
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
    return messages;
  }

  private async processMessage(message: any): Promise<void> {
    try {
      // Dispatch the event to RabbitMQ
      // We use emit() because events in NestJS microservices are usually fire-and-forget,
      // but to ensure it reached the broker, we might want to wait for it.
      // NestJS ClientProxy.emit() returns an Observable that completes when the message is sent.
      const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload;
      
      // We send the eventType as the pattern, and payload as data
      const eventObservable = this.clientProxy.emit(message.eventType, payload);
      await firstValueFrom(eventObservable);

      // 3. Mark as Completed
      await this.prisma.outboxMessage.update({
        where: { id: message.id },
        data: {
          status: 'COMPLETED',
          lockedUntil: null,
          lockedBy: null,
        },
      });

      this.logger.log(`Successfully published outbox message ${message.id} (${message.eventType})`);
    } catch (error: any) {
      this.logger.error(`Failed to publish message ${message.id}: ${error.message}`);
      await this.handlePublishFailure(message, error);
    }
  }

  private async handlePublishFailure(message: any, error: any): Promise<void> {
    const nextRetryCount = message.retryCount + 1;
    const isFailed = nextRetryCount >= this.MAX_RETRIES;
    
    // Exponential backoff logic: e.g., 2^retryCount * 5 seconds
    // Note: PostgreSQL INTERVAL syntax requires string formatting for dynamic values in raw queries, 
    // but Prisma update allows explicit DateTime. We will calculate it in JS.
    let nextLockedUntil: Date | null = null;
    if (!isFailed) {
      const backoffMs = Math.pow(2, nextRetryCount) * 5000;
      nextLockedUntil = new Date(Date.now() + backoffMs);
    }

    await this.prisma.outboxMessage.update({
      where: { id: message.id },
      data: {
        status: isFailed ? 'FAILED' : 'PENDING',
        retryCount: nextRetryCount,
        error: error.message || String(error),
        lockedBy: null,
        lockedUntil: nextLockedUntil,
      },
    });

    if (isFailed) {
      this.logger.error(`Message ${message.id} exceeded max retries and is marked as FAILED.`);
    }
  }
}
