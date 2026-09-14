import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { RequestAIInferenceCommand } from '../commands/request-ai-inference.command';
import { AIRecommendation } from '../../domain/aggregates/ai-recommendation.aggregate';
import { v4 as uuidv4 } from 'uuid';
import { Inject, Logger } from '@nestjs/common';
import { AppException, OutboxService, PrismaTransaction } from '@veerox/shared';
import { AIExecutionMode } from '@veerox/events';
import { AI_MODEL_REPOSITORY, IAIModelRepository } from '../../domain/repositories/ai-model.repository';
import { AI_CONFIGURATION_REPOSITORY, IAIConfigurationRepository } from '../../domain/repositories/ai-configuration.repository';
import { AI_RECOMMENDATION_REPOSITORY, IAIRecommendationRepository } from '../../domain/repositories/ai-recommendation.repository';
import { DomainTransaction } from '../../domain/repositories/transaction.interface';
import { PrismaClient } from '@veerox/database';
import { IAIProviderRegistry, AI_PROVIDER_REGISTRY } from '../../domain/providers/ai-provider.interface';
import { ICredentialService } from '../../domain/providers/credential.service.interface';
import { CREDENTIAL_SERVICE } from '../../domain/providers/credential.service.interface';
import { IPromptBuilder, PROMPT_BUILDER } from '../../domain/providers/prompt-builder.interface';
import Decimal from 'decimal.js';

type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

class PrismaDomainTransaction implements DomainTransaction {
  constructor(private readonly tx: PrismaTransactionClient) {}
  getProvider<T>(): T {
    return this.tx as unknown as T;
  }
}

@CommandHandler(RequestAIInferenceCommand)
export class RequestAIInferenceHandler implements ICommandHandler<RequestAIInferenceCommand> {
  private readonly logger = new Logger(RequestAIInferenceHandler.name);

  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly modelRepo: IAIModelRepository,
    @Inject(AI_CONFIGURATION_REPOSITORY) private readonly configRepo: IAIConfigurationRepository,
    @Inject(AI_RECOMMENDATION_REPOSITORY) private readonly recommendationRepo: IAIRecommendationRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly providerRegistry: IAIProviderRegistry,
    @Inject(CREDENTIAL_SERVICE) private readonly credentialService: ICredentialService,
    @Inject(PROMPT_BUILDER) private readonly promptBuilder: IPromptBuilder,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}

  async execute(command: RequestAIInferenceCommand): Promise<void> {
    const {
      organizationId,
      workspaceId,
      correlationId,
      idempotencyKey,
      modelId,
      modelVersion,
      symbolId,
      recommendationType,
      marketData,
      strategyId,
    } = command;

    try {
      // 1. Fetch config and model (can be outside tx if read-only, but let's keep it safe or just read)
      const model = await this.modelRepo.findById(modelId);
      if (!model) {
        throw new AppException('NOT_FOUND', 'AI Model not found', 404);
      }
      if (model.organizationId !== organizationId || model.workspaceId !== workspaceId) {
        throw new AppException('FORBIDDEN', 'Tenant mismatch for AI Model', 403);
      }
      if (model.status !== 'ACTIVE') {
        throw new AppException('INVALID_STATE', 'AI Model is not ACTIVE');
      }

      const config = await this.configRepo.findByWorkspaceId(workspaceId);
      if (!config || !config.enabled) {
        this.logger.warn(`AI is disabled for workspace ${workspaceId}. Ignoring recommendation.`);
        return;
      }
      if (config.organizationId !== organizationId) {
        throw new AppException('FORBIDDEN', 'Tenant mismatch for AI Configuration', 403);
      }

      // 2. Prepare Inference
      const credentials = await this.credentialService.getProviderCredentials(model.provider, organizationId, workspaceId);
      const provider = this.providerRegistry.getProvider(model.provider);
      
      const promptContext = { strategyId, symbol: symbolId, marketData };
      const systemPrompt = this.promptBuilder.buildSystemPrompt(promptContext);
      const userPrompt = this.promptBuilder.buildUserPrompt(promptContext);

      // 3. Execute Inference
      const inferenceResult = await provider.infer({
        modelId: model.id,
        provider: model.provider,
        modelName: model.modelName,
        systemPrompt,
        userPrompt,
        temperature: 0.1
      }, credentials);

      // Enforce confidence threshold
      const confidence = new Decimal(inferenceResult.confidence);
      if (confidence.toNumber() < config.properties.minimumConfidence.toNumber()) {
        this.logger.log(`Recommendation confidence ${confidence} below threshold ${config.properties.minimumConfidence}. Dropping.`);
        return;
      }

      const executionMode = config.executionMode;
      const recommendationId = uuidv4();

      // 4. Persist result in transaction
      await this.prisma.$transaction(async (tx) => {
        const domainTx = new PrismaDomainTransaction(tx as PrismaTransactionClient);

        // We re-fetch to ensure no state change, though optional
        const currentModel = await this.modelRepo.findById(modelId, domainTx);
        if (!currentModel || currentModel.status !== 'ACTIVE') {
            throw new AppException('INVALID_STATE', 'AI Model is not ACTIVE during persistence');
        }

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
          marketRegime: inferenceResult.marketRegime || null,
          suggestedSide: inferenceResult.suggestedSide === 'HOLD' ? null : inferenceResult.suggestedSide,
          suggestedSize: inferenceResult.suggestedSize ? new Decimal(inferenceResult.suggestedSize) : null,
          suggestedEntry: inferenceResult.suggestedEntry ? new Decimal(inferenceResult.suggestedEntry) : null,
          suggestedStopLoss: inferenceResult.suggestedStopLoss ? new Decimal(inferenceResult.suggestedStopLoss) : null,
          suggestedTakeProfit: inferenceResult.suggestedTakeProfit ? new Decimal(inferenceResult.suggestedTakeProfit) : null,
          reasoning: inferenceResult.reasoning,
          supportingSignals: inferenceResult.supportingSignals ? JSON.stringify(inferenceResult.supportingSignals) : null,
          status: 'GENERATED',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (executionMode === AIExecutionMode.AI_EXECUTE) {
          if (recommendation.properties.suggestedSide && recommendation.properties.suggestedSize) {
             recommendation.requestExecution();
          } else {
             this.logger.warn('AI_EXECUTE mode but missing side/size (or HOLD). Cannot request execution.');
          }
        }

        await this.recommendationRepo.save(recommendation, domainTx);
        await this.outboxService.saveEvents(domainTx.getProvider<PrismaTransaction>(), 'AIRecommendation', recommendationId, recommendation);
      });
    } catch (error: unknown) {
      const err = error as { code?: string; meta?: { target?: string | string[] } };
      if (err.code === 'P2002' && err.meta?.target?.includes('idempotency_key')) {
        this.logger.debug(`Duplicate AI recommendation detected (idempotency key: ${idempotencyKey}). Safe no-op.`);
        return;
      }
      throw error;
    }
  }
}
