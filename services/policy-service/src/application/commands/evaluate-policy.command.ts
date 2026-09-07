export class EvaluatePolicyCommand {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
  ) {}
}
