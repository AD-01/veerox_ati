import { Strategy } from './strategy.aggregate';

describe('Strategy Aggregate', () => {
  it('should initialize correctly', () => {
    const strategy = new Strategy(
      '1',
      'org-1',
      'Test',
      '1.0',
      null,
      'actor-1',
      'MODERATE',
      'DRAFT',
      new Date(),
      new Date(),
    );

    expect(strategy.id).toBe('1');
    expect(strategy.organizationId).toBe('org-1');
    expect(strategy.status).toBe('DRAFT');
  });

  it('should transition to EVALUATION', () => {
    const strategy = new Strategy(
      '1',
      'org-1',
      'Test',
      '1.0',
      null,
      'actor-1',
      'MODERATE',
      'DRAFT',
      new Date(),
      new Date(),
    );

    strategy.changeStatus('TESTING');
    expect(strategy.status).toBe('TESTING');
  });

  it('should throw error on invalid transition', () => {
    const strategy = new Strategy(
      '1',
      'org-1',
      'Test',
      '1.0',
      null,
      'actor-1',
      'MODERATE',
      'DRAFT',
      new Date(),
      new Date(),
    );

    expect(() => strategy.changeStatus('ACTIVE')).toThrow('Invalid status transition');
  });
});
