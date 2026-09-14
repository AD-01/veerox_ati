import Decimal from 'decimal.js';
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

  describe('Financial Safety Validations', () => {
    it('should throw if confidence is < 0', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, confidence: new Decimal('-0.1') }))
        .toThrow('Confidence must be between 0 and 1');
    });

    it('should throw if confidence is > 1', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, confidence: new Decimal('1.1') }))
        .toThrow('Confidence must be between 0 and 1');
    });

    it('should throw if side is invalid', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, suggestedSide: 'INVALID' }))
        .toThrow('suggestedSide must be strictly BUY or SELL');
    });

    it('should throw if size is 0', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, suggestedSize: new Decimal('0') }))
        .toThrow('suggestedSize must be strictly greater than 0');
    });

    it('should throw if size is negative', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, suggestedSize: new Decimal('-5') }))
        .toThrow('suggestedSize must be strictly greater than 0');
    });

    it('should throw if Stop Loss is negative', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, suggestedStopLoss: new Decimal('-10') }))
        .toThrow('suggestedStopLoss must be positive and finite');
    });

    it('should throw if Take Profit is 0', () => {
      expect(() => AIRecommendation.create({ ...defaultProps, suggestedTakeProfit: new Decimal('0') }))
        .toThrow('suggestedTakeProfit must be positive and finite');
    });

    it('should throw on invalid BUY SL/TP relationship', () => {
      expect(() => AIRecommendation.create({
        ...defaultProps,
        suggestedSide: 'BUY',
        suggestedEntry: new Decimal('100'),
        suggestedStopLoss: new Decimal('105'), // SL > Entry on BUY
      })).toThrow('For a BUY recommendation, Entry must be greater than Stop Loss');

      expect(() => AIRecommendation.create({
        ...defaultProps,
        suggestedSide: 'BUY',
        suggestedEntry: new Decimal('100'),
        suggestedTakeProfit: new Decimal('90'), // TP < Entry on BUY
      })).toThrow('For a BUY recommendation, Entry must be less than Take Profit');
    });

    it('should throw on invalid SELL SL/TP relationship', () => {
      expect(() => AIRecommendation.create({
        ...defaultProps,
        suggestedSide: 'SELL',
        suggestedEntry: new Decimal('100'),
        suggestedStopLoss: new Decimal('95'), // SL < Entry on SELL
      })).toThrow('For a SELL recommendation, Entry must be less than Stop Loss');

      expect(() => AIRecommendation.create({
        ...defaultProps,
        suggestedSide: 'SELL',
        suggestedEntry: new Decimal('100'),
        suggestedStopLoss: new Decimal('105'), // Valid SL for SELL
        suggestedTakeProfit: new Decimal('110'), // TP > Entry on SELL
      })).toThrow('For a SELL recommendation, Entry must be greater than Take Profit');
    });
  });
});
