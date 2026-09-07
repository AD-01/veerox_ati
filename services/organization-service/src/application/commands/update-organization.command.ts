export class UpdateOrganizationCommand {
  constructor(
    public readonly organizationId: string,
    public readonly actorId: string,
    public readonly name?: string,
    public readonly timezone?: string,
    public readonly currency?: string,
  ) {}
}
