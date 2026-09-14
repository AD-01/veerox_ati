/* eslint-disable @typescript-eslint/no-explicit-any */
import { Decimal } from 'decimal.js';

export interface IUsageRecordRepository {
  recordUsage(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    productId: string | null;
    metricName: string;
    quantity: Decimal;
    idempotencyKey: string;
  }, tx?: any): Promise<void>;
}
