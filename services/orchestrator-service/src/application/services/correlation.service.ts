import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { CommandBus } from '@nestjs/cqrs';
import { GenerateDecisionCommand } from '../commands/generate-decision.command';

@Injectable()
export class CorrelationService {
  private readonly logger = new Logger(CorrelationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: CommandBus,
  ) {}

  async correlate(eventData: {
    correlationId: string;
    workspaceId: string;
    organizationId?: string;
    opportunityPayload?: unknown;
    riskPayload?: unknown;
  }) {
    const { correlationId, workspaceId, organizationId, opportunityPayload, riskPayload } = eventData;

    try {
      const updateData: Record<string, string> = {};
      if (opportunityPayload) updateData.opportunityPayload = JSON.stringify(opportunityPayload);
      if (riskPayload) updateData.riskPayload = JSON.stringify(riskPayload);
      if (organizationId) updateData.organizationId = organizationId;

      let correlation;
      try {
        correlation = await this.prisma.decisionCorrelation.upsert({
          where: { correlationId },
          update: updateData,
          create: {
            correlationId,
            workspaceId,
            organizationId,
            opportunityPayload: opportunityPayload ? JSON.stringify(opportunityPayload) : null,
            riskPayload: riskPayload ? JSON.stringify(riskPayload) : null,
            expiresAt: new Date(Date.now() + 5000), // 5000ms fail-closed semantic
            status: 'PENDING',
          },
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
          // Recover by merging with existing correlation record
          correlation = await this.prisma.decisionCorrelation.update({
            where: { correlationId },
            data: updateData,
          });
        } else {
          throw err;
        }
      }

      // Reject cross-tenant correlation
      if (correlation.workspaceId !== workspaceId) {
        this.logger.error(`Cross-tenant correlation attempt detected for ${correlationId}`);
        throw new Error('Cross-tenant correlation attempt');
      }
      if (organizationId && correlation.organizationId && correlation.organizationId !== organizationId) {
        this.logger.error(`Cross-tenant correlation attempt detected for ${correlationId}`);
        throw new Error('Cross-tenant correlation attempt');
      }

      if (
        correlation.opportunityPayload &&
        correlation.riskPayload &&
        correlation.status === 'PENDING'
      ) {
        if (correlation.expiresAt < new Date()) {
          const updated = await this.prisma.decisionCorrelation.updateMany({
            where: { correlationId, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          if (updated.count > 0) {
            this.logger.warn(`Saga Timeout for ${correlationId}. Correlation expired.`);
          }
          return;
        }

        // Atomic compare-and-set
        const updated = await this.prisma.decisionCorrelation.updateMany({
          where: { correlationId, status: 'PENDING' },
          data: { status: 'CONSUMED' },
        });

        if (updated.count === 1) {
          const opportunity = JSON.parse(correlation.opportunityPayload);
          const risk = JSON.parse(correlation.riskPayload);
          
          const command = new GenerateDecisionCommand(
            opportunity.correlationId,
            opportunity.workspaceId,
            'system-ati',
            opportunity.organizationId,
            opportunity.accountId,
            opportunity.symbolId,
            opportunity.strategyId,
            opportunity.direction,
            opportunity.size,
            opportunity.stopLoss,
            opportunity.takeProfit,
            risk.riskScore
          );

          this.logger.log(`Atomically correlated events! Dispatching GenerateDecisionCommand for ${correlationId}`);
          await this.commandBus.execute(command);
        }
      } else if (correlation.status === 'PENDING' && correlation.expiresAt < new Date()) {
        const updated = await this.prisma.decisionCorrelation.updateMany({
          where: { correlationId, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        if (updated.count > 0) {
          this.logger.warn(`Saga Timeout for ${correlationId}. Correlation expired.`);
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error correlating events for ${correlationId}: ${error.message}`, error.stack);
    }
  }
}
