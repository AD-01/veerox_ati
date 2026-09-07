import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { GenerateAIRecommendationCommand } from '../commands/generate-ai-recommendation.command';
import { AIRecommendation } from '../../domain/aggregates/ai-recommendation.aggregate';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';
import { AppException } from '@veerox/shared';
import { AIExecutionMode } from '@veerox/events';

@CommandHandler(GenerateAIRecommendationCommand)
export class GenerateAIRecommendationHandler implements ICommandHandler<GenerateAIRecommendationCommand> {
  private readonly logger = new Logger(GenerateAIRecommendationHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GenerateAIRecommendationCommand): Promise<void> {
    const {
      organizationId,
      workspaceId,
      correlationId,
      idempotencyKey,
      modelId,
      modelVersion,
      symbolId,
      recommendationType,
      confidence,
      strategyId,
      marketRegime,
      suggestedSide,
      suggestedSize,
      suggestedEntry,
      suggestedStopLoss,
      suggestedTakeProfit,
      reasoning,
      supportingSignals,
    } = command;

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Verify Model exists and is ACTIVE
        const model = await tx.aIModel.findUnique({
          where: { id: modelId },
        });

        if (!model) {
          throw new AppException('AI Model not found');
        }

        if (model.organizationId !== organizationId || model.workspaceId !== workspaceId) {
          throw new AppException('Tenant mismatch for AI Model');
        }

        if (model.status !== 'ACTIVE') {
          throw new AppException('AI Model is not ACTIVE');
        }

        // 2. Verify AI Configuration exists and is enabled
        const config = await tx.aIConfiguration.findUnique({
          where: { workspaceId },
        });

        if (!config || !config.enabled) {
          this.logger.warn(`AI is disabled for workspace ${workspaceId}. Ignoring recommendation.`);
          return;
        }

        if (config.organizationId !== organizationId) {
          throw new AppException('Tenant mismatch for AI Configuration');
        }

        // Enforce confidence threshold
        if (confidence.toNumber() < config.minimumConfidence.toNumber()) {
          this.logger.log(`Recommendation confidence ${confidence} below threshold ${config.minimumConfidence}. Dropping.`);
          return;
        }

        const executionMode = config.executionMode;

        // 3. Create Recommendation Aggregate
        const recommendationId = uuidv4();
        
        const recommendation = AIRecommendation.create({
          id: recommendationId,
          organizationId,
          workspaceId,
          correlationId,
          idempotencyKey,
          modelId,
          modelVersion,
          strategyId: strategyId || null,
          symbolId,
          executionMode,
          recommendationType,
          confidence,
          marketRegime: marketRegime || null,
          suggestedSide: suggestedSide || null,
          suggestedSize: suggestedSize || null,
          suggestedEntry: suggestedEntry || null,
          suggestedStopLoss: suggestedStopLoss || null,
          suggestedTakeProfit: suggestedTakeProfit || null,
          reasoning: reasoning || null,
          supportingSignals: supportingSignals || null,
          status: 'GENERATED',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 4. Optionally request execution if AI_EXECUTE
        if (executionMode === AIExecutionMode.AI_EXECUTE) {
          if (suggestedSide && suggestedSize) {
             recommendation.requestExecution();
          } else {
             this.logger.warn('AI_EXECUTE mode but missing side/size. Cannot request execution.');
          }
        }

        // 5. Persist Domain State
        const props = recommendation.properties;
        await tx.aIRecommendation.create({
          data: {
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
          },
        });

        // 6. Persist Domain Events to Outbox
        for (const event of recommendation.getUncommittedEvents() as any[]) {
          await tx.outboxMessage.create({
            data: {
              id: uuidv4(),
              eventType: event.constructor.EVENT_NAME,
              payloadJson: JSON.stringify(event),
              status: 'PENDING',
              correlationId,
              organizationId,
              workspaceId,
            },
          });
        }
        recommendation.commit();
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        this.logger.debug(`Duplicate AI recommendation detected (idempotency key: ${idempotencyKey}). Safe no-op.`);
        return;
      }
      throw error;
    }
  }
}
