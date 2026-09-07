export class RegisterUserCommand {
  constructor(
    public readonly email: string,
    public readonly username: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly rawPassword: string,
  ) {}
}
