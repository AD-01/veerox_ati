export type PolicyRuleType =
  | 'WORKSPACE_ENABLED'
  | 'ACCOUNT_ENABLED'
  | 'STRATEGY_ENABLED'
  | 'SYMBOL_ALLOWED'
  | 'DIRECTION_ALLOWED'
  | 'MAX_POSITION_SIZE'
  | 'MAX_EXPOSURE'
  | 'MAX_DAILY_LOSS'
  | 'MAX_CONCURRENT_TRADES'
  | 'TRADING_SESSION';

export class PolicyRule {
  constructor(
    public readonly id: string,
    public readonly policyId: string,
    public ruleType: PolicyRuleType,
    public operator: string,
    public value: string,
    public unit: string | null,
    public enabled: boolean,
    public priority: number,
    public configuration: Record<string, unknown>,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  public disable(): void {
    this.enabled = false;
    this.updatedAt = new Date();
  }

  public enable(): void {
    this.enabled = true;
    this.updatedAt = new Date();
  }
}
