import { Injectable } from '@nestjs/common';
import { BillingPurchaseService } from '../../../../billing-service/src/application/services/billing-purchase.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BillingGrpcClient {
  constructor(private readonly billingBoundary: BillingPurchaseService) {}

  async subscribeToProduct(
    organizationId: string,
    workspaceId: string,
    productId: string,
    pricingModel: string,
    price: number,
    currency: string,
    idempotencyKey: string,
    correlationId: string = randomUUID()
  ): Promise<{ success: boolean, subscriptionId?: string, invoiceId?: string, status?: string, correlationId?: string, error?: string }> {
    const result = await this.billingBoundary.purchase({
      organizationId,
      workspaceId,
      productId,
      idempotencyKey,
      correlationId
    });
    return { success: true, ...result };
  }
}
