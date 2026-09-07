export class GetRiskAssessmentsQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}
