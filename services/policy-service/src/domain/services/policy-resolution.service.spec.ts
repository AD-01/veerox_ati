/* eslint-disable @typescript-eslint/no-explicit-any */
import { PolicyResolutionService } from './policy-resolution.service';

describe('PolicyResolutionService', () => {
  let service: PolicyResolutionService;

  beforeEach(() => {
    service = new PolicyResolutionService();
  });

  it('should immediately ALLOW when zero policies are provided', () => {
    const result = service.resolve([]);
    expect(result.outcome).toBe('ALLOW');
    expect(result.violations).toEqual([]);
    expect(result.effectiveLimits.limits).toEqual({});
  });

  it('should ALLOW when a single policy allows', () => {
    const result = service.resolve([
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxExposure: 1000 }, prohibitions: [] }
      }
    ]);
    expect(result.outcome).toBe('ALLOW');
    expect(result.effectiveLimits.limits.maxExposure).toBe(1000);
  });

  it('should REJECT when a single policy rejects', () => {
    const result = service.resolve([
      {
        outcome: 'REJECT',
        violations: [{ ruleId: 'r1', reason: 'Too high' } as any],
        effectiveLimits: { limits: { maxExposure: 1000 }, prohibitions: ['SHORT'] }
      }
    ]);
    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(1);
    expect(result.effectiveLimits.prohibitions).toContain('SHORT');
  });

  it('should ALLOW when multiple policies ALL ALLOW', () => {
    const result = service.resolve([
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxExposure: 1000 }, prohibitions: [] }
      },
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxLeverage: 10 }, prohibitions: [] }
      }
    ]);
    expect(result.outcome).toBe('ALLOW');
  });

  it('should enforce Deny-Wins: REJECT when one policy out of many rejects', () => {
    const result = service.resolve([
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxExposure: 1000 }, prohibitions: [] }
      },
      {
        outcome: 'REJECT',
        violations: [{ ruleId: 'r2', reason: 'Leverage too high' } as any],
        effectiveLimits: { limits: { maxLeverage: 10 }, prohibitions: [] }
      }
    ]);
    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(1);
  });

  it('should aggregate all violations when multiple policies reject', () => {
    const result = service.resolve([
      {
        outcome: 'REJECT',
        violations: [{ ruleId: 'r1', reason: 'Too high' } as any],
        effectiveLimits: { limits: {}, prohibitions: [] }
      },
      {
        outcome: 'REJECT',
        violations: [{ ruleId: 'r2', reason: 'Leverage too high' } as any],
        effectiveLimits: { limits: {}, prohibitions: [] }
      }
    ]);
    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(2);
  });

  it('should take the MIN restrictive effective limits across all policies', () => {
    const result = service.resolve([
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxExposure: 1000, maxLeverage: 20 }, prohibitions: [] }
      },
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxExposure: 500, maxLoss: 5000 }, prohibitions: [] }
      },
      {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: { maxLeverage: 10 }, prohibitions: [] }
      }
    ]);
    
    // min maxExposure: 500 (from policy 2 vs 1000 in policy 1)
    // min maxLeverage: 10 (from policy 3 vs 20 in policy 1)
    // min maxLoss: 5000 (from policy 2)
    
    expect(result.effectiveLimits.limits.maxExposure).toBe(500);
    expect(result.effectiveLimits.limits.maxLeverage).toBe(10);
    expect(result.effectiveLimits.limits.maxLoss).toBe(5000);
  });
});
