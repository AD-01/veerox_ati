export interface WorkspaceConfigProps {
  tradingPolicies: string;
  riskLimits: string;
  notificationSettings: string;
  strategyPreferences: string;
  automationMode: string;
}

export class WorkspaceConfig {
  private constructor(private readonly props: WorkspaceConfigProps) {}

  public static create(props: WorkspaceConfigProps): WorkspaceConfig {
    // We could add validation logic here (e.g., check valid automation mode)
    return new WorkspaceConfig(props);
  }

  get tradingPolicies(): string { return this.props.tradingPolicies; }
  get riskLimits(): string { return this.props.riskLimits; }
  get notificationSettings(): string { return this.props.notificationSettings; }
  get strategyPreferences(): string { return this.props.strategyPreferences; }
  get automationMode(): string { return this.props.automationMode; }

  public update(newProps: Partial<WorkspaceConfigProps>): WorkspaceConfig {
    return new WorkspaceConfig({
      ...this.props,
      ...newProps,
    });
  }

  // To serialize back to primitive for DB
  public toPrimitive(): WorkspaceConfigProps {
    return {
      tradingPolicies: this.props.tradingPolicies,
      riskLimits: this.props.riskLimits,
      notificationSettings: this.props.notificationSettings,
      strategyPreferences: this.props.strategyPreferences,
      automationMode: this.props.automationMode,
    };
  }
}
