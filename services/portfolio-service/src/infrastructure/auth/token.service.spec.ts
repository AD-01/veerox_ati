import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@veerox/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@veerox/database';
import * as crypto from 'crypto';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let prismaService: jest.Mocked<Partial<PrismaService>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redisClient: any;

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn().mockImplementation(async (payload, options) => `mockToken-${options.expiresIn}`),
    };
    redisClient = {
      set: jest.fn(),
      get: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_IDLE_TIMEOUT') return '7d';
        if (key === 'JWT_SESSION_ABSOLUTE_TIMEOUT') return '30d';
        return null;
      }),
    };
    prismaService = {
      session: {
        create: jest.fn().mockResolvedValue({}),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokens', () => {
    it('should generate tokens and create a db session', async () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const tokens = await service.generateTokens(payload, '127.0.0.1', 'test-device');

      expect(tokens.accessToken).toBe('mockToken-15m');
      expect(tokens.refreshToken).toBe('mockToken-30d');
      expect(tokens.expiresIn).toBe(900);
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(prismaService.session!.create).toHaveBeenCalled();
    });

    it('should throw error if config is missing', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      await expect(service.generateTokens({ sub: '123', email: 'e' }, '127', 'device')).rejects.toThrow('JWT_ACCESS_EXPIRES_IN configuration is missing');
    });
  });

  describe('revokeToken & isTokenRevoked', () => {
    it('should hash the token and store in redis with TTL', async () => {
      await service.revokeToken('my-token', 900);
      const expectedHash = crypto.createHash('sha256').update('my-token').digest('hex');
      expect(redisClient.set).toHaveBeenCalledWith(`revoked_token:${expectedHash}`, 'revoked', 'EX', 900);
    });

    it('should check if token is revoked', async () => {
      redisClient.get.mockResolvedValue('revoked');
      const isRevoked = await service.isTokenRevoked('my-token');
      expect(isRevoked).toBe(true);
    });
  });
});
