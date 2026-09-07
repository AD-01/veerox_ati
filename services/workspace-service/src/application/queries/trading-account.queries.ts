export class GetTradingAccountQuery {
  constructor(
    public readonly accountId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}

export class ListTradingAccountsQuery {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}
