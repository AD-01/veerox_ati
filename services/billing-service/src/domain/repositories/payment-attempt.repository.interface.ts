/* eslint-disable @typescript-eslint/no-explicit-any */
import { PaymentAttempt } from '../aggregates/payment-attempt.aggregate';

export interface IPaymentAttemptRepository {
  findByIdempotencyKey(key: string, tx?: any): Promise<PaymentAttempt | null>;
  save(attempt: PaymentAttempt, tx?: any): Promise<void>;
}
