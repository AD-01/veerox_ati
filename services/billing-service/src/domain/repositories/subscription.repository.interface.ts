/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from '../aggregates/subscription.aggregate';

export interface ISubscriptionRepository {
  findById(id: string, tx?: any): Promise<Subscription | null>;
  save(subscription: Subscription, tx?: any): Promise<void>;
}
