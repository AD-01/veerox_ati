import { PolicyAggregate } from '../aggregates/policy.aggregate';
import { PolicyRule } from '../entities/policy-rule.entity';
import { PolicyViolation } from '../value-objects/policy-violation.vo';
import { EffectiveLimits } from '../value-objects/effective-limits.vo';

export interface PolicyEvaluationContext {
  organizationId: string;
  workspaceId: string;
  accountId: string;
  strategyId: string | null;
  symbolId: string;
  tradeDirection: 'LONG' | 'SHORT';
  requestedSize: number;
}

export class PolicyEvaluationResult {
  constructor(
    public readonly policyId: string,
    public readonly policyVersion: number,
    public readonly outcome: 'ALLOW' | 'REJECT',
    public readonly violations: PolicyViolation[],
    public readonly effectiveLimits: EffectiveLimits,
    public readonly evaluatedRules: string[],
    public readonly explanation: Record<string, unknown>,
  ) {}
}

export class PolicyEngineService {
  /**
   * Evaluates a single policy against the given context.
   * Deterministic fail-closed engine.
   */
  public evaluate(policy: PolicyAggregate, context: PolicyEvaluationContext): PolicyEvaluationResult {
    // 1. Applicability Check
    if (!this.isPolicyApplicable(policy, context)) {
      return new PolicyEvaluationResult(
        policy.id,
        policy.version,
        'ALLOW',
        [],
        new EffectiveLimits(),
        [],
        { reason: 'Policy not applicable to current context scope.' }
      );
    }

    const violations: PolicyViolation[] = [];
    const evaluatedRules: string[] = [];
    const effectiveLimits = new EffectiveLimits();

    // 2. Evaluate Individual Rules
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;

      evaluatedRules.push(rule.id);
      
      const violation = this.evaluateRule(rule, context, effectiveLimits);
      if (violation) {
        violations.push(violation);
      }
    }

    // 3. Conflict Resolution & Deny Wins
    // If any applicable rule produces a hard violation -> REJECT
    const outcome = violations.length > 0 ? 'REJECT' : 'ALLOW';

    return new PolicyEvaluationResult(
      policy.id,
      policy.version,
      outcome,
      violations,
      effectiveLimits,
      evaluatedRules,
      {
        violationsCount: violations.length,
        evaluatedCount: evaluatedRules.length,
      }
    );
  }

  private isPolicyApplicable(policy: PolicyAggregate, context: PolicyEvaluationContext): boolean {
    if (policy.organizationId !== context.organizationId || policy.workspaceId !== context.workspaceId) {
      return false; // Wrong tenant
    }

    switch (policy.scope) {
      case 'ORGANIZATION':
      case 'WORKSPACE':
        return true;
      case 'ACCOUNT':
        // Policy applies globally to the workspace in Phase 04-A model, 
        // specific targets are handled by rules.
        return true; 
      case 'STRATEGY':
        return true;
      case 'SYMBOL':
        return true;
      default:
        return false;
    }
  }

  private evaluateRule(rule: PolicyRule, context: PolicyEvaluationContext, limits: EffectiveLimits): PolicyViolation | null {
    switch (rule.ruleType) {
      case 'WORKSPACE_ENABLED':
      case 'ACCOUNT_ENABLED':
      case 'STRATEGY_ENABLED': {
        // Evaluate if context ID matches target
        const targetId = rule.configuration['targetId'] as string;
        let actualId: string | null = null;
        if (rule.ruleType === 'ACCOUNT_ENABLED') actualId = context.accountId;
        else if (rule.ruleType === 'STRATEGY_ENABLED') actualId = context.strategyId;
        else if (rule.ruleType === 'WORKSPACE_ENABLED') actualId = context.workspaceId;

        // If targetId is specified and it doesn't match the current context, the rule doesn't apply
        if (targetId && targetId !== actualId) {
          return null; // Not applicable
        }

        const isEnabled = rule.value === 'true' || rule.value === 'TRUE';
        if (!isEnabled) {
          limits.setProhibited(rule.ruleType);
          return new PolicyViolation(
            rule.id,
            rule.ruleType,
            rule.ruleType,
            false,
            true,
            rule.operator,
            'HIGH',
            `${rule.ruleType} is disabled by policy`
          );
        }
        return null;
      }

      case 'SYMBOL_ALLOWED': {
        if (!this.evaluateStringCondition(context.symbolId, rule.operator, rule.value)) {
          limits.setProhibited(`SYMBOL_${context.symbolId}`);
          return new PolicyViolation(
            rule.id,
            rule.ruleType,
            'symbolId',
            context.symbolId,
            rule.value,
            rule.operator,
            'HIGH',
            `Symbol ${context.symbolId} is not allowed`
          );
        }
        return null;
      }

      case 'DIRECTION_ALLOWED': {
        if (!this.evaluateStringCondition(context.tradeDirection, rule.operator, rule.value)) {
          limits.setProhibited(`DIRECTION_${context.tradeDirection}`);
          return new PolicyViolation(
            rule.id,
            rule.ruleType,
            'tradeDirection',
            context.tradeDirection,
            rule.value,
            rule.operator,
            'HIGH',
            `Direction ${context.tradeDirection} is not allowed`
          );
        }
        return null;
      }

      case 'MAX_POSITION_SIZE': {
        const configuredLimit = parseFloat(rule.value);
        if (isNaN(configuredLimit)) {
          // Invalid configuration -> Fail closed
          return new PolicyViolation(rule.id, rule.ruleType, 'positionSize', context.requestedSize, rule.value, rule.operator, 'CRITICAL', 'Invalid configured limit');
        }

        limits.setMinimum('MAX_POSITION_SIZE', configuredLimit);

        if (!this.evaluateNumericCondition(context.requestedSize, rule.operator, configuredLimit)) {
          return new PolicyViolation(
            rule.id,
            rule.ruleType,
            'positionSize',
            context.requestedSize,
            configuredLimit,
            rule.operator,
            'HIGH',
            `Position size ${context.requestedSize} exceeds max ${configuredLimit}`
          );
        }
        return null;
      }

      case 'MAX_EXPOSURE':
      case 'MAX_DAILY_LOSS':
      case 'MAX_CONCURRENT_TRADES': {
        // Risk context required but not currently provided in base Decision context.
        // Fail closed.
        return new PolicyViolation(
          rule.id,
          rule.ruleType,
          'riskContext',
          'MISSING',
          rule.value,
          rule.operator,
          'CRITICAL',
          `Required risk context for ${rule.ruleType} is missing`
        );
      }

      default:
        // Unknown rule type -> Fail closed
        return new PolicyViolation(
          rule.id,
          rule.ruleType,
          'unknown',
          'N/A',
          'N/A',
          rule.operator,
          'CRITICAL',
          `Unknown rule type ${rule.ruleType}`
        );
    }
  }

  private evaluateNumericCondition(actual: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'LTE': return actual <= target;
      case 'LT': return actual < target;
      case 'GTE': return actual >= target;
      case 'GT': return actual > target;
      case 'EQ': return actual === target;
      case 'NEQ': return actual !== target;
      default: return false; // Fail closed on unknown operator
    }
  }

  private evaluateStringCondition(actual: string, operator: string, target: string): boolean {
    switch (operator) {
      case 'EQ': return actual === target;
      case 'NEQ': return actual !== target;
      case 'IN': {
        const list = target.split(',').map(s => s.trim());
        return list.includes(actual);
      }
      case 'NOT_IN': {
        const list = target.split(',').map(s => s.trim());
        return !list.includes(actual);
      }
      default: return false; // Fail closed
    }
  }
}
