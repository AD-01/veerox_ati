import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaMarketplaceRepository } from '../../infrastructure/repositories/prisma-marketplace.repository';
import { BillingGrpcClient } from '../../infrastructure/grpc/billing-grpc.client';
import { PrismaService } from '@veerox/database';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export class InitiatePurchaseCommand {
  constructor(
    public readonly workspaceId: string, // The buyer
    public readonly organizationId: string, // The buyer's organization
    public readonly productId: string,
    public readonly idempotencyKey?: string
  ) {}
}

@CommandHandler(InitiatePurchaseCommand)
export class InitiatePurchaseHandler implements ICommandHandler<InitiatePurchaseCommand> {
  private readonly logger = new Logger(InitiatePurchaseHandler.name);

  constructor(
    private readonly marketplaceRepo: PrismaMarketplaceRepository,
    private readonly billingClient: BillingGrpcClient,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: InitiatePurchaseCommand): Promise<{ success: boolean, subscriptionId?: string, invoiceId?: string, status?: string, correlationId?: string, error?: string }> {
    const idempotencyKey = command.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new Error('Idempotency key is required');
    }
    const correlationId = randomUUID();

    // 1. Idempotency Check
    try {
      await this.prisma.idempotentCommand.create({
        data: {
          idempotencyKey,
          commandName: InitiatePurchaseCommand.name,
          organizationId: command.organizationId,
          workspaceId: command.workspaceId
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const existing = await this.prisma.idempotentCommand.findUnique({
          where: { idempotencyKey }
        });
        if (!existing || existing.organizationId !== command.organizationId || existing.workspaceId !== command.workspaceId) {
          throw new Error('Idempotency key is already bound to a different purchase request');
        }
        if (existing.resultId) {
          const purchase = await this.prisma.productSubscription.findUnique({
            where: { id: existing.resultId }
          });
          if (purchase) {
            return { success: true, correlationId, error: undefined, subscriptionId: purchase.id, invoiceId: undefined };
          }
        }

        return { success: true, correlationId, error: 'IN_FLIGHT' };
      }
      throw error;
    }

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: command.workspaceId },
        select: { organizationId: true }
      });
      if (!workspace || workspace.organizationId !== command.organizationId) {
        throw new Error('Workspace does not belong to organization');
      }

      const product = await this.marketplaceRepo.findById(command.productId);
      
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.status !== 'ACTIVE') {
        throw new Error(`Product is not available for purchase (status: ${product.status})`);
      }

      // Call Billing Service via gRPC to initiate the financial transaction
      const response = await this.billingClient.subscribeToProduct(
        command.organizationId,
        command.workspaceId,
        product.id,
        product.pricingModel,
        product.price,
        product.currency,
        idempotencyKey,
        correlationId
      );

      if (!response.success) {
        throw new Error(`Billing integration failed: ${response.error}`);
      }

      const result = { success: true, subscriptionId: response.subscriptionId, invoiceId: response.invoiceId, status: response.status, correlationId: response.correlationId || correlationId };
      await this.prisma.idempotentCommand.update({
        where: { idempotencyKey },
        data: { resultId: response.subscriptionId }
      });
      this.logger.log(`Initiated purchase for product ${product.id} via subscription ${response.subscriptionId}`);
      return result;

    } catch (error: any) {
      this.logger.error(`Failed to initiate purchase: ${error.message}`, error.stack);
      
      // Rollback idempotency marker so client can retry safely
      await this.prisma.idempotentCommand.delete({
        where: { idempotencyKey }
      }).catch((err: any) => this.logger.error(`Failed to rollback idempotency key ${idempotencyKey}`, err.stack));
      
      throw error;
    }
  }
}
