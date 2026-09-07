export class ArchiveOrganizationCommand {
  constructor(
    public readonly organizationId: string,
    public readonly actorId: string,
    public readonly reason?: string,
  ) {}
}
