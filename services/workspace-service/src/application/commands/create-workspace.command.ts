export class CreateWorkspaceCommand {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly creatorUserId: string,
    public readonly initialTradingPolicies?: string,
    public readonly initialRiskLimits?: string,
    public readonly initialNotificationSettings?: string,
    public readonly initialStrategyPreferences?: string,
    public readonly automationMode?: string,
  ) {}
}
