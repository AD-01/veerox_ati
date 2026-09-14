import { AIConfiguration } from '../ai-configuration.aggregate';
import Decimal from 'decimal.js';

describe('AIConfiguration Aggregate', () => {
  const validProps = {
    id: 'config-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    enabled: true,
    executionMode: 'AI_EXECUTE',
    minimumConfidence: new Decimal(0.8),
    maxRiskPerTrade: new Decimal(100),
    maxDailyLoss: new Decimal(1000),
    maxOpenPositions: 5,
    maxPositionSize: new Decimal(10),
    requirePolicyApproval: true,
    allowedSymbols: null,
    allowedSessions: null,
    inferenceIntervalMinutes: 15,
    lastInferenceAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should create with valid interval', () => {
    const config = AIConfiguration.create(validProps);
    expect(config.inferenceIntervalMinutes).toBe(15);
  });

  it('should reject zero interval', () => {
    expect(() => AIConfiguration.create({ ...validProps, inferenceIntervalMinutes: 0 }))
      .toThrow('inferenceIntervalMinutes must be a finite number greater than 0');
  });

  it('should reject negative interval', () => {
    expect(() => AIConfiguration.create({ ...validProps, inferenceIntervalMinutes: -5 }))
      .toThrow('inferenceIntervalMinutes must be a finite number greater than 0');
  });

  it('should reject infinite interval', () => {
    expect(() => AIConfiguration.create({ ...validProps, inferenceIntervalMinutes: Infinity }))
      .toThrow('inferenceIntervalMinutes must be a finite number greater than 0');
  });
});
