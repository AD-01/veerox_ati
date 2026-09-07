export class CreateOrganizationCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly ownerUserId: string,
    public readonly timezone?: string,
    public readonly currency?: string,
  ) {}
}
