export class AssignStrategyCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly strategyId: string,
    public readonly expertAdvisorId: string,
    public readonly actorId: string,
  ) {}
}
