/* eslint-disable @typescript-eslint/no-explicit-any */
import { BillingLedgerEntry } from '../aggregates/billing-ledger.aggregate';

export interface IBillingLedgerRepository {
  save(entry: BillingLedgerEntry, tx?: any): Promise<void>;
}
