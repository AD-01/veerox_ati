export class ResolvePolicyDecisionCommand {
  constructor(
    public readonly correlationId: string,
    public readonly decisionId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}
