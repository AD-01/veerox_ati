export class UpdateWorkspaceSettingsCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly updaterUserId: string,
    public readonly settings: {
      tradingPolicies?: string;
      riskLimits?: string;
      notificationSettings?: string;
      strategyPreferences?: string;
      automationMode?: string;
    }
  ) {}
}
