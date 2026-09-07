import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LogoutCommand } from '../commands/logout.command';
import { TokenService } from '../../infrastructure/auth/token.service';
import { PrismaService } from '@veerox/database/src/prisma.service';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    // Revoke the access token in Redis
    // We pass 900 seconds (15 mins) as a default blocklist TTL.
    // In a fully strictly verified system we'd extract actual token expiry.
    await this.tokenService.revokeToken(command.accessToken, 900);

    // Revoke the session in the DB to invalidate the Refresh Token
    if (command.sessionId) {
      await this.prisma.session.updateMany({
        where: { id: command.sessionId },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  }
}
