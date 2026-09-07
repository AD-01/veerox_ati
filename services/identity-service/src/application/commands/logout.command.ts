export class LogoutCommand {
  constructor(
    public readonly accessToken: string,
    public readonly sessionId?: string,
  ) {}
}
