export class RegisterExpertAdvisorCommand {
  constructor(
    public readonly organizationId: string,
    public readonly strategyId: string,
    public readonly version: string,
    public readonly binaryUrl: string | null,
    public readonly sourceUrl: string | null,
    public readonly signature: string | null,
    public readonly actorId: string,
  ) {}
}

export class ChangeExpertAdvisorStatusCommand {
  constructor(
    public readonly expertAdvisorId: string,
    public readonly organizationId: string,
    public readonly status: 'TESTING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DEPRECATED',
    public readonly actorId: string,
  ) {}
}
