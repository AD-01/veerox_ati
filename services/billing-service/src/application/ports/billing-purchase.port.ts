export interface BillingPurchaseRequest {
  organizationId: string;
  workspaceId: string;
  productId: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface BillingPurchaseResponse {
  subscriptionId: string;
  invoiceId: string;
  status: string;
  correlationId: string;
}

export interface IBillingPurchaseBoundary {
  purchase(request: BillingPurchaseRequest): Promise<BillingPurchaseResponse>;
}
