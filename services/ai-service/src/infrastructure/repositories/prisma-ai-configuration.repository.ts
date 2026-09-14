import { Injectable } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@veerox/database';
import { IAIConfigurationRepository } from '../../domain/repositories/ai-configuration.repository';
import { AIConfiguration } from '../../domain/aggregates/ai-configuration.aggregate';
import { DomainTransaction } from '../../domain/repositories/transaction.interface';

type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
import { AIExecutionMode } from '@veerox/events';

@Injectable()
export class PrismaAIConfigurationRepository implements IAIConfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByWorkspaceId(workspaceId: string, tx?: DomainTransaction): Promise<AIConfiguration | null> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const record = await db.aIConfiguration.findUnique({ where: { workspaceId } });
    if (!record) return null;

    return AIConfiguration.reconstitute({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      enabled: record.enabled,
      executionMode: record.executionMode as AIExecutionMode,
      minimumConfidence: record.minimumConfidence,
      maxRiskPerTrade: record.maxRiskPerTrade,
      maxDailyLoss: record.maxDailyLoss,
      maxOpenPositions: record.maxOpenPositions,
      maxPositionSize: record.maxPositionSize,
      requirePolicyApproval: record.requirePolicyApproval,
      allowedSymbols: record.allowedSymbols,
      allowedSessions: record.allowedSessions,
      inferenceIntervalMinutes: record.inferenceIntervalMinutes,
      lastInferenceAt: record.lastInferenceAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(configuration: AIConfiguration, tx?: DomainTransaction): Promise<void> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const props = configuration.properties;
    
    await db.aIConfiguration.upsert({
      where: { workspaceId: props.workspaceId },
      update: {
        enabled: props.enabled,
        executionMode: props.executionMode,
        minimumConfidence: props.minimumConfidence,
        maxRiskPerTrade: props.maxRiskPerTrade,
        maxDailyLoss: props.maxDailyLoss,
        maxOpenPositions: props.maxOpenPositions,
        maxPositionSize: props.maxPositionSize,
        requirePolicyApproval: props.requirePolicyApproval,
        allowedSymbols: props.allowedSymbols,
        allowedSessions: props.allowedSessions,
        inferenceIntervalMinutes: props.inferenceIntervalMinutes,
        lastInferenceAt: props.lastInferenceAt,
        updatedAt: props.updatedAt,
      },
      create: {
        id: props.id,
        organizationId: props.organizationId,
        workspaceId: props.workspaceId,
        enabled: props.enabled,
        executionMode: props.executionMode,
        minimumConfidence: props.minimumConfidence,
        maxRiskPerTrade: props.maxRiskPerTrade,
        maxDailyLoss: props.maxDailyLoss,
        maxOpenPositions: props.maxOpenPositions,
        maxPositionSize: props.maxPositionSize,
        requirePolicyApproval: props.requirePolicyApproval,
        allowedSymbols: props.allowedSymbols,
        allowedSessions: props.allowedSessions,
        inferenceIntervalMinutes: props.inferenceIntervalMinutes,
        lastInferenceAt: props.lastInferenceAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      }
    });
  }
}
