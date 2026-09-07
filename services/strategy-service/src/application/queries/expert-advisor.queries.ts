export class GetExpertAdvisorByIdQuery {
  constructor(
    public readonly expertAdvisorId: string,
    public readonly organizationId: string,
  ) {}
}
