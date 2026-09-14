import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { TokenService } from '../../infrastructure/auth/token.service';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '@veerox/shared';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { Inject } from '@nestjs/common';
import { UserStatus } from '../../domain/aggregates/user.aggregate';
import { PrismaService } from '@veerox/database';
import * as argon2 from 'argon2';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RefreshTokenCommand) {
    try {
      const payload = await this.jwtService.verifyAsync(command.refreshToken, { ignoreExpiration: true });
      
      if (!payload.sessionId) {
        throw new AppException('INVALID_TOKEN', 'Malformed refresh token', 401);
      }

      // Lookup session in DB
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session) {
        throw new AppException('INVALID_TOKEN', 'Session not found', 401);
      }

      if (session.absoluteExpiresAt && session.absoluteExpiresAt < new Date()) {
        throw new AppException('INVALID_TOKEN', 'Session absolute maximum expired', 401);
      }

      if (session.revokedAt) {
        const timeSinceRevocation = Date.now() - session.revokedAt.getTime();
        // 30-second concurrent refresh grace period
        if (timeSinceRevocation > 30000) {
          throw new AppException('INVALID_TOKEN', 'Session revoked', 401);
        }
      } else if (session.expiresAt < new Date()) {
        throw new AppException('INVALID_TOKEN', 'Session idle timeout expired', 401);
      }

      const isValidHash = await argon2.verify(session.refreshTokenHash, command.refreshToken).catch(() => false);
      if (!isValidHash) {
        throw new AppException('INVALID_TOKEN', 'Invalid refresh token', 401);
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new AppException('INVALID_TOKEN', 'User not found', 401);
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppException('USER_INACTIVE', 'User is not active', 403);
      }

      // Revoke the old session to prevent reuse (if not already revoked during concurrent refresh)
      if (!session.revokedAt) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }

      const newPayload = { sub: user.id, email: user.email.value };
      return this.tokenService.generateTokens(newPayload, command.ipAddress, command.deviceInfo, session.absoluteExpiresAt || undefined);
    } catch (e) {
      if (e instanceof AppException) throw e;
      throw new AppException('INVALID_TOKEN', 'Invalid refresh token', 401);
    }
  }
}
