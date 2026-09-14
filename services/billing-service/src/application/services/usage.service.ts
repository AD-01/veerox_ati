import { Injectable, Inject } from '@nestjs/common';
import { IUsageRecordRepository } from '../../domain/repositories/usage.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { Decimal } from 'decimal.js';

@Injectable()
export class UsageService {
  constructor(
    @Inject('IUsageRecordRepository') private readonly usageRepo: IUsageRecordRepository,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    private readonly prisma: PrismaService
  ) {}

  async recordUsage(props: {
    organizationId: string;
    workspaceId: string;
    productId?: string;
    metricName: string;
    quantity: Decimal;
    idempotencyKey: string;
  }): Promise<string> {
    let qty: Decimal;
    try {
      qty = new Decimal(props.quantity);
    } catch (e) {
      throw new Error('Malformed Decimal input for quantity');
    }

    // CRITICAL: Validate quantity before ANY database mutation
    if (qty.isNaN() || !qty.isFinite() || qty.lte(0)) {
      throw new Error('Quantity must be a positive finite number');
    }

    try {
      const usageId = await this.prisma.$transaction(async (tx) => {
        // CRITICAL FIX: Generate ID inside transaction for idempotency
        const id = crypto.randomUUID();
        
        // Record usage with idempotency guarantee
        await this.usageRepo.recordUsage({
          id,
          organizationId: props.organizationId,
          workspaceId: props.workspaceId,
          productId: props.productId || null,
          metricName: props.metricName,
          quantity: qty,
          idempotencyKey: props.idempotencyKey
        }, tx);

        await this.auditRepo.log({
          action: 'USAGE_RECORDED',
          organizationId: props.organizationId,
          workspaceId: props.workspaceId,
          targetEntityId: id,
          targetEntityType: 'USAGE_RECORD',
          newState: JSON.stringify({ metricName: props.metricName, quantity: qty.toString() })
        }, tx);

        return id;
      });

      return usageId;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        // Idempotent recovery: find existing usage record by idempotency key
        const existing = await this.prisma.usageRecord.findUnique({
          where: { idempotencyKey: props.idempotencyKey }
        });

        if (existing) {
          return existing.id;
        }

        throw new Error('Usage idempotency collision detected but record not recoverable');
      }
      throw error;
    }
  }
}
