/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { IOutboxRepository } from '../ports/outbox.repository.interface';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { PrismaService } from '@veerox/database';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject('ISubscriptionRepository') private readonly subscriptionRepo: ISubscriptionRepository,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    @Inject('IOutboxRepository') private readonly outboxRepo: IOutboxRepository,
    private readonly prisma: PrismaService
  ) {}

  async createSubscription(props: {
    organizationId: string;
    workspaceId: string;
    productId: string;
    billingPeriod: string;
    idempotencyKey?: string;
  }): Promise<string> {
    const subscriptionId = crypto.randomUUID();

    try {
      await this.prisma.$transaction(async (tx) => {
        if (props.idempotencyKey) {
          await tx.idempotentCommand.create({
            data: {
              idempotencyKey: props.idempotencyKey,
              commandName: 'CreateSubscription',
              organizationId: props.organizationId,
              workspaceId: props.workspaceId,
              resultId: subscriptionId
            }
          });
        }

      const subscription = Subscription.create({
        id: subscriptionId,
        ...props
      });

      await this.subscriptionRepo.save(subscription, tx);
      await this.outboxRepo.publishAll(subscription.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'SUBSCRIPTION_CREATED',
        organizationId: props.organizationId,
        workspaceId: props.workspaceId,
        targetEntityId: subscriptionId,
        targetEntityType: 'SUBSCRIPTION',
        newState: JSON.stringify({ status: subscription.status, productId: props.productId })
      }, tx);
      });
    } catch (error: any) {
      if (error.code === 'P2002' && props.idempotencyKey) {
        // Recover original result from idempotentCommand first
        const cmd = await this.prisma.idempotentCommand.findUnique({
          where: { idempotencyKey: props.idempotencyKey }
        });
        if (cmd && cmd.resultId) return cmd.resultId;

        // Fallback: check productSubscription directly
        const existing = await this.prisma.productSubscription.findFirst({
          where: { idempotencyKey: props.idempotencyKey }
        });
        if (existing) return existing.id;
      }
      throw error;
    }

    return subscriptionId;
  }

  async activateSubscription(subscriptionId: string, nextBillingDate: Date, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const subscription = await this.subscriptionRepo.findById(subscriptionId, tx);
      if (!subscription) throw new Error('Subscription not found');

      // Tenant isolation check
      if (subscription.organizationId !== organizationId || subscription.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      const prevState = subscription.status;
      subscription.activate(nextBillingDate);

      await this.subscriptionRepo.save(subscription, tx);
      await this.outboxRepo.publishAll(subscription.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'SUBSCRIPTION_ACTIVATED',
        organizationId,
        workspaceId,
        targetEntityId: subscriptionId,
        targetEntityType: 'SUBSCRIPTION',
        previousState: JSON.stringify({ status: prevState }),
        newState: JSON.stringify({ status: subscription.status })
      }, tx);
    });
  }

  async cancelSubscription(subscriptionId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const subscription = await this.subscriptionRepo.findById(subscriptionId, tx);
      if (!subscription) throw new Error('Subscription not found');

      if (subscription.organizationId !== organizationId || subscription.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      const prevState = subscription.status;
      subscription.cancel();

      await this.subscriptionRepo.save(subscription, tx);
      await this.outboxRepo.publishAll(subscription.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'SUBSCRIPTION_CANCELED',
        organizationId,
        workspaceId,
        targetEntityId: subscriptionId,
        targetEntityType: 'SUBSCRIPTION',
        previousState: JSON.stringify({ status: prevState }),
        newState: JSON.stringify({ status: subscription.status })
      }, tx);
    });
  }

  async suspendSubscription(subscriptionId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const subscription = await this.subscriptionRepo.findById(subscriptionId, tx);
      if (!subscription) throw new Error('Subscription not found');

      if (subscription.organizationId !== organizationId || subscription.workspaceId !== workspaceId) {
        throw new Error('Unauthorized');
      }

      const prevState = subscription.status;
      subscription.suspend();

      await this.subscriptionRepo.save(subscription, tx);
      await this.outboxRepo.publishAll(subscription.getUncommittedEvents(), tx);

      await this.auditRepo.log({
        action: 'SUBSCRIPTION_SUSPENDED',
        organizationId,
        workspaceId,
        targetEntityId: subscriptionId,
        targetEntityType: 'SUBSCRIPTION',
        previousState: JSON.stringify({ status: prevState }),
        newState: JSON.stringify({ status: subscription.status })
      }, tx);
    });
  }
}
