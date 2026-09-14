import { RequestAIInferenceHandler } from '../request-ai-inference.handler';
import { RequestAIInferenceCommand } from '../../commands/request-ai-inference.command';
import { PrismaService } from '@veerox/database';
import { OutboxService, AppException } from '@veerox/shared';
import { IAIModelRepository } from '../../../domain/repositories/ai-model.repository';
import { IAIConfigurationRepository } from '../../../domain/repositories/ai-configuration.repository';
import { IAIRecommendationRepository } from '../../../domain/repositories/ai-recommendation.repository';
import { IAIProviderRegistry, IAIProvider, InferenceResponse } from '../../../domain/providers/ai-provider.interface';
import { ICredentialService } from '../../../domain/providers/credential.service.interface';
import { IPromptBuilder } from '../../../domain/providers/prompt-builder.interface';
import Decimal from 'decimal.js';

describe('RequestAIInferenceHandler', () => {
  let handler: RequestAIInferenceHandler;
  let modelRepo: jest.Mocked<IAIModelRepository>;
  let configRepo: jest.Mocked<IAIConfigurationRepository>;
  let recommendationRepo: jest.Mocked<IAIRecommendationRepository>;
  let providerRegistry: jest.Mocked<IAIProviderRegistry>;
  let credentialService: jest.Mocked<ICredentialService>;
  let promptBuilder: jest.Mocked<IPromptBuilder>;
  let prismaService: unknown;
  let outboxService: jest.Mocked<OutboxService>;
  let mockProvider: jest.Mocked<IAIProvider>;

  beforeEach(() => {
    modelRepo = { findById: jest.fn(), save: jest.fn() } as unknown as jest.Mocked<IAIModelRepository>;
    configRepo = { findByWorkspaceId: jest.fn(), save: jest.fn() } as unknown as jest.Mocked<IAIConfigurationRepository>;
    recommendationRepo = { findById: jest.fn(), save: jest.fn() } as unknown as jest.Mocked<IAIRecommendationRepository>;
    
    mockProvider = { name: 'MOCK', infer: jest.fn() } as unknown as jest.Mocked<IAIProvider>;
    providerRegistry = { getProvider: jest.fn().mockReturnValue(mockProvider) } as unknown as jest.Mocked<IAIProviderRegistry>;
    
    credentialService = { getProviderCredentials: jest.fn().mockResolvedValue({ KEY: 'VAL' }) } as unknown as jest.Mocked<ICredentialService>;
    promptBuilder = { buildSystemPrompt: jest.fn().mockReturnValue('sys'), buildUserPrompt: jest.fn().mockReturnValue('usr') } as unknown as jest.Mocked<IPromptBuilder>;

    outboxService = { saveEvents: jest.fn() } as unknown as jest.Mocked<OutboxService>;

    prismaService = {
      $transaction: jest.fn(async (cb) => {
        return cb({});
      }),
    };

    handler = new RequestAIInferenceHandler(
      modelRepo,
      configRepo,
      recommendationRepo,
      providerRegistry,
      credentialService,
      promptBuilder,
      prismaService as unknown as PrismaService,
      outboxService
    );
  });

  const baseCommand = new RequestAIInferenceCommand(
    'org-1',
    'ws-1',
    'corr-1',
    'idem-1',
    'model-1',
    '1.0',
    'sym-1',
    'STRATEGY_RUN',
    { ohlcv: [] },
    'strat-1'
  );

  const mockModel = {
    id: 'model-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    provider: 'MOCK',
    modelName: 'mock-model',
    status: 'ACTIVE'
  };

  const mockConfig = {
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    enabled: true,
    executionMode: 'AI_EXECUTE',
    properties: {
      minimumConfidence: new Decimal(0.5)
    }
  };

  it('should request inference and generate AIRecommendation in AI_EXECUTE mode', async () => {
    modelRepo.findById.mockResolvedValue(mockModel as unknown as NonNullable<Awaited<ReturnType<IAIModelRepository['findById']>>>);
    configRepo.findByWorkspaceId.mockResolvedValue(mockConfig as unknown as NonNullable<Awaited<ReturnType<IAIConfigurationRepository['findByWorkspaceId']>>>);
    
    mockProvider.infer.mockResolvedValue({
      confidence: 0.9,
      marketRegime: 'TREND',
      suggestedSide: 'BUY',
      suggestedSize: 1.5,
      suggestedEntry: 100,
      suggestedStopLoss: 90,
      suggestedTakeProfit: 120,
      reasoning: 'looks good',
      providerMetadata: { promptTokens: 10, completionTokens: 10, totalTokens: 20, latencyMs: 100 }
    } as InferenceResponse);

    await handler.execute(baseCommand);

    expect(credentialService.getProviderCredentials).toHaveBeenCalledWith('MOCK', 'org-1', 'ws-1');
    expect(mockProvider.infer).toHaveBeenCalled();
    expect(recommendationRepo.save).toHaveBeenCalled();
    expect(outboxService.saveEvents).toHaveBeenCalled();
    
    const savedRecommendation = recommendationRepo.save.mock.calls[0][0];
    expect(savedRecommendation.properties.suggestedSide).toBe('BUY');
    expect(savedRecommendation.properties.suggestedSize?.toNumber()).toBe(1.5);
    // Should have updated status to EXECUTION_REQUESTED due to AI_EXECUTE
    expect(savedRecommendation.properties.status).toBe('EXECUTION_REQUESTED');
  });

  it('should ignore recommendation if confidence is below threshold', async () => {
    modelRepo.findById.mockResolvedValue(mockModel as unknown as NonNullable<Awaited<ReturnType<IAIModelRepository['findById']>>>);
    configRepo.findByWorkspaceId.mockResolvedValue(mockConfig as unknown as NonNullable<Awaited<ReturnType<IAIConfigurationRepository['findByWorkspaceId']>>>);
    
    mockProvider.infer.mockResolvedValue({
      confidence: 0.3, // Below 0.5
      marketRegime: 'TREND',
      suggestedSide: 'BUY',
      suggestedSize: 1.5,
      suggestedEntry: 100,
      suggestedStopLoss: 90,
      suggestedTakeProfit: 120,
      reasoning: 'low confidence',
      providerMetadata: { promptTokens: 10, completionTokens: 10, totalTokens: 20, latencyMs: 100 }
    } as InferenceResponse);

    await handler.execute(baseCommand);

    expect(recommendationRepo.save).not.toHaveBeenCalled();
  });

  it('should fail if provider output violates financial invariants', async () => {
    modelRepo.findById.mockResolvedValue(mockModel as unknown as NonNullable<Awaited<ReturnType<IAIModelRepository['findById']>>>);
    configRepo.findByWorkspaceId.mockResolvedValue(mockConfig as unknown as NonNullable<Awaited<ReturnType<IAIConfigurationRepository['findByWorkspaceId']>>>);
    
    mockProvider.infer.mockResolvedValue({
      confidence: 0.9,
      marketRegime: 'TREND',
      suggestedSide: 'BUY',
      suggestedSize: -10, // Invalid size
      suggestedEntry: 100,
      suggestedStopLoss: 90,
      suggestedTakeProfit: 120,
      reasoning: 'malformed output',
      providerMetadata: { promptTokens: 10, completionTokens: 10, totalTokens: 20, latencyMs: 100 }
    } as InferenceResponse);

    await expect(handler.execute(baseCommand)).rejects.toThrow(AppException);
    expect(recommendationRepo.save).not.toHaveBeenCalled();
  });
});
