export interface EventEffectiveLimits {
  limits: Record<string, number | string | boolean>;
  prohibitions: string[];
}

export interface EventPolicyViolation {
  ruleId: string;
  ruleType: string;
  field: string;
  actualValue: string | number | boolean;
  configuredValue: string | number | boolean;
  operator: string;
  severity: string;
  reason: string;
}

export interface PolicyEvaluationResult {
  outcome: string; // 'ALLOW' | 'REJECT'
  violations: EventPolicyViolation[];
  effectiveLimits: EventEffectiveLimits;
}

export interface PolicyResolutionResult {
  outcome: string;
  violations: EventPolicyViolation[];
  effectiveLimits: EventEffectiveLimits;
}

export class PolicyResolutionService {
  /**
   * Resolves a set of policy evaluations into a single definitive outcome.
   * Enforces Deny-Wins logic, violation aggregation, and MIN effective limits.
   */
  public resolve(evaluations: PolicyEvaluationResult[]): PolicyResolutionResult {
    // Zero policies => immediate ALLOW
    if (evaluations.length === 0) {
      return {
        outcome: 'ALLOW',
        violations: [],
        effectiveLimits: { limits: {}, prohibitions: [] }
      };
    }

    let finalOutcome = 'ALLOW';
    const allViolations: EventPolicyViolation[] = [];
    const mergedLimits: Record<string, number | string | boolean> = {};
    const prohibitions = new Set<string>();

    for (const evaluation of evaluations) {
      if (evaluation.outcome === 'REJECT') {
        finalOutcome = 'REJECT'; // ANY REJECT => REJECT
      }

      allViolations.push(...evaluation.violations);

      const limits = evaluation.effectiveLimits?.limits || {};
      for (const [key, value] of Object.entries(limits)) {
        // MIN restrictive effective limits logic
        if (mergedLimits[key] === undefined || value < mergedLimits[key]) {
          mergedLimits[key] = value;
        }
      }

      const evaluationProhibitions = evaluation.effectiveLimits?.prohibitions || [];
      for (const p of evaluationProhibitions) {
        prohibitions.add(p);
      }
    }

    return {
      outcome: finalOutcome,
      violations: allViolations,
      effectiveLimits: {
        limits: mergedLimits,
        prohibitions: Array.from(prohibitions)
      }
    };
  }
}
