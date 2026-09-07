export class RiskLimitReachedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly limitType: string,
    public readonly currentValue: number,
    public readonly thresholdValue: number,
    public readonly timestamp: Date,
  ) {}
}
