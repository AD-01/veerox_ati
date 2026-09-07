import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { LoginCommand } from '../commands/login.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { Inject } from '@nestjs/common';
import { AppException } from '@veerox/shared/src/errors/app.exception';
import { UserStatus } from '../../domain/aggregates/user.aggregate';
import { TokenService } from '../../infrastructure/auth/token.service';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly publisher: EventPublisher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      throw new AppException('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException('USER_INACTIVE', 'User is not active', 403);
    }

    const isPasswordValid = await user.passwordHash.compare(command.rawPassword);
    if (!isPasswordValid) {
      throw new AppException('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    const payload = { sub: user.id, email: user.email.value };
    const tokens = await this.tokenService.generateTokens(
      payload,
      command.ipAddress,
      command.deviceInfo,
    );
    
    return tokens;
  }
}
