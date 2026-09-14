import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from '../commands/register-user.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { User } from '../../domain/aggregates/user.aggregate';
import { Email } from '../../domain/value-objects/email.value-object';
import { PasswordHash } from '../../domain/value-objects/password-hash.value-object';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppException } from '@veerox/shared';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterUserCommand): Promise<string> {
    const email = Email.create(command.email);

    // Check if email is already taken
    const existingEmail = await this.userRepository.findByEmail(email.value);
    if (existingEmail) {
      throw new AppException('EMAIL_EXISTS', 'Email already exists', 409);
    }

    // Check if username is already taken
    const existingUsername = await this.userRepository.findByUsername(command.username);
    if (existingUsername) {
      throw new AppException('USERNAME_EXISTS', 'Username already exists', 409);
    }

    // Hash password
    const passwordHash = await PasswordHash.hash(command.rawPassword);

    // Create User Aggregate
    const user = User.create(
      randomUUID(),
      email,
      command.username,
      command.firstName,
      command.lastName,
      passwordHash,
    );

    // Save to repository
    await this.userRepository.save(user);

    await this.auditRepository.log({
      targetUserId: user.id,
      action: 'RegisterUser',
      newState: JSON.stringify({ email: email.value, username: command.username }),
    });

    for (const event of user.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    user.commit();

    return user.id;
  }
}
