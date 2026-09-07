import { ExpertAdvisor } from './expert-advisor.aggregate';

describe('ExpertAdvisor Aggregate', () => {
  it('should initialize correctly', () => {
    const ea = new ExpertAdvisor(
      '1',
      'org-1',
      'strat-1',
      '1.0',
      's3://bucket/binary',
      's3://bucket/source',
      'sig',
      'DRAFT',
      new Date(),
      new Date(),
    );

    expect(ea.id).toBe('1');
    expect(ea.organizationId).toBe('org-1');
    expect(ea.status).toBe('DRAFT');
  });

  it('should transition to APPROVED', () => {
    const ea = new ExpertAdvisor(
      '1',
      'org-1',
      'strat-1',
      '1.0',
      's3://bucket/binary',
      's3://bucket/source',
      'sig',
      'DRAFT',
      new Date(),
      new Date(),
    );

    ea.changeStatus('APPROVED');
    expect(ea.status).toBe('APPROVED');
  });

  it('should throw error on invalid transition', () => {
    const ea = new ExpertAdvisor(
      '1',
      'org-1',
      'strat-1',
      '1.0',
      's3://bucket/binary',
      's3://bucket/source',
      'sig',
      'DRAFT',
      new Date(),
      new Date(),
    );

    expect(() => ea.changeStatus('ACTIVE')).toThrow('Invalid status transition');
  });
});
