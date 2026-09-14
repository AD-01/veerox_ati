import { Decimal } from 'decimal.js';

export interface CreatePaymentResult {
  success: boolean;
  providerPaymentId?: string;
  errorMessage?: string;
}

export interface PaymentProvider {
  createPayment(
    amount: Decimal,
    currency: string,
    idempotencyKey: string,
    metadata?: Record<string, string>
  ): Promise<CreatePaymentResult>;

  verifyPayment(providerPaymentId: string): Promise<boolean>;

  refundPayment(
    providerPaymentId: string,
    amount: Decimal,
    idempotencyKey: string
  ): Promise<boolean>;
}
