import { PolicyEngineService, PolicyEvaluationContext } from './policy-engine.service';
import { PolicyAggregate } from '../aggregates/policy.aggregate';
import { PolicyRule } from '../entities/policy-rule.entity';
import { PolicyName } from '../value-objects/policy-name.vo';
import { PolicyPriority } from '../value-objects/policy-priority.vo';
import { PolicyVersion } from '../value-objects/policy-version.vo';

describe('PolicyEngineService', () => {
  let engine: PolicyEngineService;

  beforeEach(() => {
    engine = new PolicyEngineService();
  });

  const baseContext: PolicyEvaluationContext = {
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    accountId: 'acc-1',
    strategyId: 'strat-1',
    symbolId: 'BTCUSD',
    tradeDirection: 'LONG',
    requestedSize: 100,
  };

  it('should allow if no rules are violated', () => {
    const policy = new PolicyAggregate(
      'policy-1',
      'org-1',
      'ws-1',
      new PolicyName('Test Policy'),
      null,
      'WORKSPACE',
      'ACTIVE',
      new PolicyPriority(1),
      new PolicyVersion(1),
      [],
      new Date(),
      new Date()
    );

    policy.addRule(new PolicyRule('rule-1', 'policy-1', 'MAX_POSITION_SIZE', 'LTE', '200', 'USD', true, 1, {}, new Date(), new Date()));

    const result = engine.evaluate(policy, baseContext);

    expect(result.outcome).toBe('ALLOW');
    expect(result.violations.length).toBe(0);
    expect(result.effectiveLimits.get('MAX_POSITION_SIZE')).toBe(200);
  });

  it('should reject if a rule is violated', () => {
    const policy = new PolicyAggregate(
      'policy-1',
      'org-1',
      'ws-1',
      new PolicyName('Test Policy'),
      null,
      'WORKSPACE',
      'ACTIVE',
      new PolicyPriority(1),
      new PolicyVersion(1),
      [],
      new Date(),
      new Date()
    );

    // Max size is 50, requested is 100
    policy.addRule(new PolicyRule('rule-1', 'policy-1', 'MAX_POSITION_SIZE', 'LTE', '50', 'USD', true, 1, {}, new Date(), new Date()));

    const result = engine.evaluate(policy, baseContext);

    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].actualValue).toBe(100);
    expect(result.effectiveLimits.get('MAX_POSITION_SIZE')).toBe(50);
  });

  it('should fail closed for missing risk context', () => {
    const policy = new PolicyAggregate(
      'policy-1',
      'org-1',
      'ws-1',
      new PolicyName('Test Policy'),
      null,
      'WORKSPACE',
      'ACTIVE',
      new PolicyPriority(1),
      new PolicyVersion(1),
      [],
      new Date(),
      new Date()
    );

    policy.addRule(new PolicyRule('rule-1', 'policy-1', 'MAX_EXPOSURE', 'LTE', '1000', 'USD', true, 1, {}, new Date(), new Date()));

    const result = engine.evaluate(policy, baseContext);

    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].field).toBe('riskContext');
  });

  it('should evaluate IN operator for SYMBOL_ALLOWED', () => {
    const policy = new PolicyAggregate(
      'policy-1',
      'org-1',
      'ws-1',
      new PolicyName('Test Policy'),
      null,
      'WORKSPACE',
      'ACTIVE',
      new PolicyPriority(1),
      new PolicyVersion(1),
      [],
      new Date(),
      new Date()
    );

    policy.addRule(new PolicyRule('rule-1', 'policy-1', 'SYMBOL_ALLOWED', 'IN', 'EURUSD, GBPUSD', '', true, 1, {}, new Date(), new Date()));

    const result = engine.evaluate(policy, baseContext); // baseContext has 'BTCUSD'

    expect(result.outcome).toBe('REJECT');
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].actualValue).toBe('BTCUSD');
  });
});
