export class RefreshTokenCommand {
  constructor(
    public readonly refreshToken: string,
    public readonly ipAddress: string,
    public readonly deviceInfo: string,
  ) {}
}
