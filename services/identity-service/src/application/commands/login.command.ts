export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly rawPassword: string,
    public readonly ipAddress: string,
    public readonly deviceInfo: string,
  ) {}
}
