export type PolicyViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class PolicyViolation {
  constructor(
    public readonly ruleId: string,
    public readonly ruleType: string,
    public readonly field: string,
    public readonly actualValue: string | number | boolean,
    public readonly configuredValue: string | number | boolean,
    public readonly operator: string,
    public readonly severity: PolicyViolationSeverity,
    public readonly reason: string,
  ) {}

  public toJSON(): Record<string, unknown> {
    return {
      ruleId: this.ruleId,
      ruleType: this.ruleType,
      field: this.field,
      actualValue: this.actualValue,
      configuredValue: this.configuredValue,
      operator: this.operator,
      severity: this.severity,
      reason: this.reason,
    };
  }
}
