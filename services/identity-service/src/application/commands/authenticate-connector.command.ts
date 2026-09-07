export class AuthenticateConnectorCommand {
  constructor(
    public readonly connectorId: string,
    public readonly clientSecret: string,
    public readonly ipAddress: string,
  ) {}
}
