import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { TokenService } from '../../infrastructure/auth/token.service';
import { JwtService } from '@nestjs/jwt';
import { USER_REPOSITORY } from '../ports/user.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenService: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRepository: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaService: any;

  beforeEach(async () => {
    tokenService = { generateTokens: jest.fn().mockResolvedValue({ accessToken: 'new', refreshToken: 'new' }) };
    jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sessionId: 'session-1' }) };
    userRepository = { findById: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE', email: { value: 'a@b.c' } }) };
    prismaService = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', revokedAt: null, expiresAt: new Date(Date.now() + 10000), refreshTokenHash: 'hash' }),
        update: jest.fn(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenHandler,
        { provide: TokenService, useValue: tokenService },
        { provide: JwtService, useValue: jwtService },
        { provide: USER_REPOSITORY, useValue: userRepository },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    handler = module.get<RefreshTokenHandler>(RefreshTokenHandler);
  });

  it('should successfully rotate tokens', async () => {
    const cmd = new RefreshTokenCommand('valid-token', '127.0.0.1', 'device');
    const res = await handler.execute(cmd);
    expect(res.accessToken).toBe('new');
    expect(prismaService.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-1' } })
    );
  });

  it('should throw if session is revoked outside grace period', async () => {
    prismaService.session.findUnique.mockResolvedValue({ id: 'session-1', revokedAt: new Date(Date.now() - 60000) });
    const cmd = new RefreshTokenCommand('token', 'ip', 'dev');
    await expect(handler.execute(cmd)).rejects.toThrow('Session revoked');
  });

  it('should allow refresh if session is revoked within 30 seconds (grace period)', async () => {
    prismaService.session.findUnique.mockResolvedValue({ 
      id: 'session-1', 
      revokedAt: new Date(Date.now() - 10000), // 10 seconds ago
      expiresAt: new Date(Date.now() + 10000), 
      refreshTokenHash: 'hash',
      absoluteExpiresAt: new Date(Date.now() + 100000)
    });
    const cmd = new RefreshTokenCommand('token', 'ip', 'dev');
    const res = await handler.execute(cmd);
    expect(res.accessToken).toBe('new');
    // Ensure we do NOT try to revoke it again
    expect(prismaService.session.update).not.toHaveBeenCalled();
  });

  it('should throw if hash is invalid', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(false);
    const cmd = new RefreshTokenCommand('token', 'ip', 'dev');
    await expect(handler.execute(cmd)).rejects.toThrow('Invalid refresh token');
  });
});
