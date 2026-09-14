import { Injectable } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@veerox/database';
import { IAIRecommendationRepository } from '../../domain/repositories/ai-recommendation.repository';
import { AIRecommendation } from '../../domain/aggregates/ai-recommendation.aggregate';
import { DomainTransaction } from '../../domain/repositories/transaction.interface';

type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
import { AIExecutionMode } from '@veerox/events';

@Injectable()
export class PrismaAIRecommendationRepository implements IAIRecommendationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: DomainTransaction): Promise<AIRecommendation | null> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const record = await db.aIRecommendation.findUnique({ where: { id } });
    if (!record) return null;

    return AIRecommendation.reconstitute({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      correlationId: record.correlationId,
      idempotencyKey: record.idempotencyKey,
      modelId: record.modelId,
      modelVersion: record.modelVersion,
      strategyId: record.strategyId,
      symbolId: record.symbolId,
      executionMode: record.executionMode as AIExecutionMode,
      recommendationType: record.recommendationType,
      confidence: record.confidence,
      marketRegime: record.marketRegime,
      suggestedSide: record.suggestedSide,
      suggestedSize: record.suggestedSize,
      suggestedEntry: record.suggestedEntry,
      suggestedStopLoss: record.suggestedStopLoss,
      suggestedTakeProfit: record.suggestedTakeProfit,
      reasoning: record.reasoning,
      supportingSignals: record.supportingSignals,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(recommendation: AIRecommendation, tx?: DomainTransaction): Promise<void> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const props = recommendation.properties;
    
    await db.aIRecommendation.upsert({
      where: { id: props.id },
      update: {
        status: props.status,
        updatedAt: props.updatedAt,
      },
      create: {
        id: props.id,
        organizationId: props.organizationId,
        workspaceId: props.workspaceId,
        correlationId: props.correlationId,
        idempotencyKey: props.idempotencyKey,
        modelId: props.modelId,
        modelVersion: props.modelVersion,
        strategyId: props.strategyId,
        symbolId: props.symbolId,
        executionMode: props.executionMode,
        recommendationType: props.recommendationType,
        confidence: props.confidence,
        marketRegime: props.marketRegime,
        suggestedSide: props.suggestedSide,
        suggestedSize: props.suggestedSize,
        suggestedEntry: props.suggestedEntry,
        suggestedStopLoss: props.suggestedStopLoss,
        suggestedTakeProfit: props.suggestedTakeProfit,
        reasoning: props.reasoning,
        supportingSignals: props.supportingSignals,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      }
    });
  }
}
