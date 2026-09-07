import { GenerateAIRecommendationHandler } from './generate-ai-recommendation.handler';
import { GenerateAIRecommendationCommand } from '../commands/generate-ai-recommendation.command';
import { PrismaService } from '@veerox/database';
import { Decimal } from '@prisma/client/runtime/library';
import { AIExecutionMode } from '@veerox/events';
import { AppException } from '@veerox/shared';

describe('GenerateAIRecommendationHandler', () => {
  let handler: GenerateAIRecommendationHandler;
  let prismaService: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      aIModel: {
        findUnique: jest.fn(),
      },
      aIConfiguration: {
        findUnique: jest.fn(),
      },
      aIRecommendation: {
        create: jest.fn(),
      },
      outboxMessage: {
        create: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn(async (cb) => {
        return cb(tx);
      }),
    };

    handler = new GenerateAIRecommendationHandler(prismaService as unknown as PrismaService);
  });

  const baseCommand = new GenerateAIRecommendationCommand(
    'org-1',
    'ws-1',
    'corr-1',
    'idem-1',
    'model-1',
    '1.0',
    'sym-1',
    'TECHNICAL',
    new Decimal('0.9'),
    'strat-1',
    'TRENDING',
    'BUY',
    new Decimal('1.0'),
    new Decimal('100'),
    new Decimal('95'),
    new Decimal('110'),
    'Test reasoning',
    null
  );

  it('should throw if model does not exist', async () => {
    tx.aIModel.findUnique.mockResolvedValue(null);

    await expect(handler.execute(baseCommand)).rejects.toThrow(AppException);
    await expect(handler.execute(baseCommand)).rejects.toThrow('AI Model not found');
  });

  it('should ignore recommendation if config is disabled', async () => {
    tx.aIModel.findUnique.mockResolvedValue({
      id: 'model-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      status: 'ACTIVE',
    });

    tx.aIConfiguration.findUnique.mockResolvedValue({
      id: 'config-1',
      workspaceId: 'ws-1',
      enabled: false, // disabled
    });

    await handler.execute(baseCommand);

    expect(tx.aIRecommendation.create).not.toHaveBeenCalled();
    expect(tx.outboxMessage.create).not.toHaveBeenCalled();
  });

  it('should create recommendation and outbox events for SIGNAL_ONLY', async () => {
    tx.aIModel.findUnique.mockResolvedValue({
      id: 'model-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      status: 'ACTIVE',
    });

    tx.aIConfiguration.findUnique.mockResolvedValue({
      id: 'config-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      enabled: true,
      executionMode: AIExecutionMode.SIGNAL_ONLY,
      minimumConfidence: new Decimal('0.8'),
    });

    await handler.execute(baseCommand);

    expect(tx.aIRecommendation.create).toHaveBeenCalled();
    expect(tx.outboxMessage.create).toHaveBeenCalled(); // AIRecommendationGeneratedEvent
    
    // Check it did not request execution
    const createCall = tx.aIRecommendation.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('GENERATED');
  });

  it('should create recommendation and request execution for AI_EXECUTE', async () => {
    tx.aIModel.findUnique.mockResolvedValue({
      id: 'model-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      status: 'ACTIVE',
    });

    tx.aIConfiguration.findUnique.mockResolvedValue({
      id: 'config-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      enabled: true,
      executionMode: AIExecutionMode.AI_EXECUTE,
      minimumConfidence: new Decimal('0.8'),
    });

    await handler.execute(baseCommand);

    expect(tx.aIRecommendation.create).toHaveBeenCalled();
    // Two events: Generated + ExecutionRequested
    expect(tx.outboxMessage.create).toHaveBeenCalledTimes(2); 
    
    const createCall = tx.aIRecommendation.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('EXECUTION_REQUESTED');
  });
});
