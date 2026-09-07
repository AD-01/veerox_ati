import { Test, TestingModule } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { LogoutCommand } from '../commands/logout.command';
import { TokenService } from '../../infrastructure/auth/token.service';
import { PrismaService } from '@veerox/database/src/prisma.service';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  let tokenService: jest.Mocked<Partial<TokenService>>;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    tokenService = {
      revokeToken: jest.fn(),
    };
    prismaService = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        { provide: TokenService, useValue: tokenService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    handler = module.get<LogoutHandler>(LogoutHandler);
  });

  it('should revoke access token in redis', async () => {
    const cmd = new LogoutCommand('access-token');
    await handler.execute(cmd);
    expect(tokenService.revokeToken).toHaveBeenCalledWith('access-token', 900);
    expect(prismaService.session!.updateMany).not.toHaveBeenCalled();
  });

  it('should revoke access token in redis and session in db if sessionId is provided', async () => {
    const cmd = new LogoutCommand('access-token', 'session-123');
    await handler.execute(cmd);
    expect(tokenService.revokeToken).toHaveBeenCalledWith('access-token', 900);
    expect(prismaService.session!.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-123' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
