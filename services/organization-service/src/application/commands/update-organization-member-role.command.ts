export class UpdateOrganizationMemberRoleCommand {
  constructor(
    public readonly organizationId: string,
    public readonly targetUserId: string,
    public readonly role: string,
    public readonly actorUserId: string,
  ) {}
}
