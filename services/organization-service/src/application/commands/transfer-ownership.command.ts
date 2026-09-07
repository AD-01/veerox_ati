export class TransferOrganizationOwnershipCommand {
  constructor(
    public readonly organizationId: string,
    public readonly newOwnerUserId: string,
    public readonly actorId: string,
    public readonly confirmationCode: string, // Requires confirmation
  ) {}
}
