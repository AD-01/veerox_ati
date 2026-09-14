import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LicenseIssuedEvent } from '@veerox/events';
import { PrismaMarketplaceRepository } from '../repositories/prisma-marketplace.repository';
import { PrismaService } from '@veerox/database';

@Injectable()
export class MarketplaceEventConsumer {
  private readonly logger = new Logger(MarketplaceEventConsumer.name);
  private readonly CONSUMER_ID = 'MarketplaceEventConsumer';

  constructor(
    private readonly marketplaceRepo: PrismaMarketplaceRepository,
    private readonly prisma: PrismaService
  ) {}

  @OnEvent(LicenseIssuedEvent.name)
  async handleLicenseIssuedEvent(event: LicenseIssuedEvent): Promise<void> {
    this.logger.log(`Received LicenseIssuedEvent for product ${event.productId}, workspace ${event.workspaceId}`);

    // Check Idempotency and run within a transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. ProcessedEvent Insert (Throws P2002 if duplicate)
        await tx.processedEvent.create({
          data: {
            eventId: event.id,
            consumerId: this.CONSUMER_ID
          }
        });

        // 2. Fetch and Update Product
        const product = await this.marketplaceRepo.findById(event.productId, tx);
        if (product) {
          product.incrementPurchaseCount();
          // Pass the transaction to the repository
          await this.marketplaceRepo.save(product, tx);
          this.logger.log(`Incremented purchase count for product ${product.id}. New count: ${product.purchaseCount}`);
        } else {
          this.logger.warn(`Received LicenseIssuedEvent for unknown product ${event.productId}`);
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.warn(`Event ${event.id} already processed by ${this.CONSUMER_ID}. Skipping.`);
        return; // Idempotent success
      }
      this.logger.error(`Failed to process LicenseIssuedEvent ${event.id}`, error.stack);
      throw error;
    }
  }
}
