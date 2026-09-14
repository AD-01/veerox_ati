import { Injectable, Logger } from '@nestjs/common';
import { ProductSubscriptionActivatedEvent, ProductSubscriptionCanceledEvent } from '@veerox/events';
import { LicenseService } from '../../application/services/license.service';
import { PrismaService } from '@veerox/database';

@Injectable()
export class BillingEventConsumer {
  private readonly logger = new Logger(BillingEventConsumer.name);
  private readonly CONSUMER_ID = 'BillingEventConsumer';

  constructor(
    private readonly licenseService: LicenseService,
    private readonly prisma: PrismaService
  ) {}

  async handleProductSubscriptionActivated(event: ProductSubscriptionActivatedEvent): Promise<void> {
    try {
      this.logger.log(`Received ProductSubscriptionActivatedEvent for ${event.subscriptionId}`);
      
      await this.prisma.$transaction(async (tx) => {
        try {
          await tx.processedEvent.create({
            data: { eventId: event.id, consumerId: this.CONSUMER_ID }
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            this.logger.warn(`Event ${event.id} already processed by ${this.CONSUMER_ID}. Skipping.`);
            return;
          }
          throw error;
        }

        const subscription = await tx.productSubscription.findUnique({
          where: { id: event.subscriptionId },
          select: { organizationId: true, workspaceId: true, productId: true, status: true }
        });
        if (!subscription || subscription.organizationId !== event.organizationId || subscription.workspaceId !== event.workspaceId || subscription.productId !== event.productId || subscription.status !== 'ACTIVE') {
          throw new Error('Subscription does not authorize this license event');
        }

        await this.licenseService.issueAndActivateLicense({
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          productId: event.productId,
          subscriptionId: event.subscriptionId
        }, tx);
      }, { maxWait: 20000, timeout: 30000 });
      
    } catch (error: any) {
      this.logger.error(`Error processing ProductSubscriptionActivatedEvent: ${error.message}`, error.stack);
      
      throw error;
    }
  }

  async handleProductSubscriptionCanceled(event: ProductSubscriptionCanceledEvent): Promise<void> {
    try {
      this.logger.log(`Received ProductSubscriptionCanceledEvent for ${event.subscriptionId}`);
      
      // 1. Idempotency Check
      try {
        await this.prisma.processedEvent.create({
          data: {
            eventId: event.id,
            consumerId: this.CONSUMER_ID
          }
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          this.logger.warn(`Event ${event.id} already processed by ${this.CONSUMER_ID}. Skipping.`);
          return;
        }
        throw error;
      }

      // 2. Revoke the license for this subscription
      // We don't have findBySubscriptionId directly in LicenseService, but we have a Prisma connection here.
      const license = await this.prisma.license.findFirst({
        where: { subscriptionId: event.subscriptionId }
      });

      if (license) {
        await this.licenseService.revokeLicense(license.id, event.organizationId, event.workspaceId, 'Subscription Canceled');
      }
    } catch (error: any) {
      this.logger.error(`Error processing ProductSubscriptionCanceledEvent: ${error.message}`, error.stack);
      
      // Rollback idempotency marker if we failed so we can retry safely
      await this.prisma.processedEvent.delete({
        where: { eventId_consumerId: { eventId: event.id, consumerId: this.CONSUMER_ID } }
      }).catch((err: any) => this.logger.error(`Failed to rollback idempotency marker for event ${event.id}`, err.stack));

      throw error;
    }
  }
}
