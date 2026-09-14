export class GetRiskUtilizationQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly accountId: string,
  ) {}
}
