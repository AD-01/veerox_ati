import { PaymentProvider, CreatePaymentResult } from '../../domain/services/payment-provider.interface';
import { Decimal } from 'decimal.js';

export class MockPaymentProvider implements PaymentProvider {
  async createPayment(
    amount: Decimal,
    currency: string,
    idempotencyKey: string,
    _metadata?: Record<string, string>
  ): Promise<CreatePaymentResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // For testing purposes, we can simulate failures based on the idempotency key or amount
    if (idempotencyKey.includes('FAIL_SIMULATION') || amount.lessThan(0)) {
      return {
        success: false,
        errorMessage: 'Mock payment failed simulation'
      };
    }

    return {
      success: true,
      providerPaymentId: `mock_pi_${crypto.randomUUID().replace(/-/g, '')}`
    };
  }

  async verifyPayment(providerPaymentId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 20));
    return providerPaymentId.startsWith('mock_pi_');
  }

  async refundPayment(
    providerPaymentId: string,
    _amount: Decimal,
    _idempotencyKey: string
  ): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return providerPaymentId.startsWith('mock_pi_');
  }
}
