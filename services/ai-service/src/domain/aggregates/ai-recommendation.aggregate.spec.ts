import { Decimal } from '@prisma/client/runtime/library';
import { AIRecommendation } from './ai-recommendation.aggregate';
import { AIExecutionMode, AIRecommendationGeneratedEvent, AIRecommendationExecutionRequestedEvent, AIRecommendationStatus } from '@veerox/events';
import { AppException } from '@veerox/shared';

describe('AIRecommendation', () => {
  const defaultProps = {
    id: 'rec-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    modelId: 'model-1',
    modelVersion: '1.0',
    strategyId: 'strat-1',
    symbolId: 'sym-1',
    executionMode: AIExecutionMode.SIGNAL_ONLY,
    recommendationType: 'TECHNICAL',
    confidence: new Decimal('0.85'),
    marketRegime: 'TRENDING',
    suggestedSide: 'BUY',
    suggestedSize: new Decimal('1.0'),
    suggestedEntry: new Decimal('100.0'),
    suggestedStopLoss: new Decimal('95.0'),
    suggestedTakeProfit: new Decimal('110.0'),
    reasoning: 'Strong momentum',
    supportingSignals: null,
    status: AIRecommendationStatus.GENERATING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should create and emit AIRecommendationGeneratedEvent', () => {
    const recommendation = AIRecommendation.create({
      ...defaultProps,
      status: AIRecommendationStatus.GENERATED,
    });

    expect(recommendation.id).toBe('rec-1');
    const events = recommendation.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(AIRecommendationGeneratedEvent);
    
    const event = events[0] as AIRecommendationGeneratedEvent;
    expect(event.recommendationId).toBe('rec-1');
    expect(event.confidence).toBe(0.85);
  });

  it('should not allow execution request in SIGNAL_ONLY mode', () => {
    const recommendation = AIRecommendation.create({
      ...defaultProps,
      status: AIRecommendationStatus.GENERATED,
    });
    recommendation.commit();

    expect(() => recommendation.requestExecution()).toThrow(AppException);
    expect(() => recommendation.requestExecution()).toThrow('Execution not allowed for SIGNAL_ONLY recommendations');
  });

  it('should allow execution request in AI_EXECUTE mode and emit event', () => {
    const recommendation = AIRecommendation.create({
      ...defaultProps,
      executionMode: AIExecutionMode.AI_EXECUTE,
      status: AIRecommendationStatus.GENERATED,
    });
    recommendation.commit();

    recommendation.requestExecution();

    const events = recommendation.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(AIRecommendationExecutionRequestedEvent);
    expect(recommendation.status).toBe(AIRecommendationStatus.EXECUTION_REQUESTED);
  });

  it('should not allow execution request if missing side or size', () => {
    const recommendation = AIRecommendation.create({
      ...defaultProps,
      executionMode: AIExecutionMode.AI_EXECUTE,
      suggestedSide: null,
      status: AIRecommendationStatus.GENERATED,
    });
    recommendation.commit();

    expect(() => recommendation.requestExecution()).toThrow(AppException);
    expect(() => recommendation.requestExecution()).toThrow('Execution request requires side and size');
  });
});
