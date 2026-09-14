import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@veerox/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@veerox/database';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

export interface TokenPayload {
  sub: string;
  email: string;
  sessionId?: string;
  type?: 'human';
}

export interface MachineTokenPayload {
  sub: string;
  type: 'connector';
  workspaceId: string;
  organizationId: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private parseExpiresIn(expiresIn: string): number {
    // Basic parser for '15m', '7d', '24h', or numeric string
    if (!isNaN(Number(expiresIn))) return Number(expiresIn);
    
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) return 900; // default 15 mins in seconds
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value * 86400;
      case 'h': return value * 3600;
      case 'm': return value * 60;
      case 's': return value;
      default: return 900;
    }
  }

  async generateTokens(payload: TokenPayload, ipAddress: string, deviceInfo: string, existingAbsoluteExpiresAt?: Date) {
    const accessTokenExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    if (!accessTokenExpires) throw new Error('JWT_ACCESS_EXPIRES_IN configuration is missing');

    const refreshTokenIdle = this.configService.get<string>('JWT_REFRESH_IDLE_TIMEOUT');
    if (!refreshTokenIdle) throw new Error('JWT_REFRESH_IDLE_TIMEOUT configuration is missing');

    const sessionAbsolute = this.configService.get<string>('JWT_SESSION_ABSOLUTE_TIMEOUT');
    if (!sessionAbsolute) throw new Error('JWT_SESSION_ABSOLUTE_TIMEOUT configuration is missing');

    const sessionId = crypto.randomUUID();
    const tokenPayload = { ...payload, sessionId };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: accessTokenExpires as any as number,
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: sessionAbsolute as any as number, // Sign the JWT with absolute timeout so it doesn't hard-fail JWT verification before our DB idle check
    });

    const refreshHash = await argon2.hash(refreshToken, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const idleSeconds = this.parseExpiresIn(refreshTokenIdle);
    const expiresAt = new Date(Date.now() + idleSeconds * 1000);

    const absoluteSeconds = this.parseExpiresIn(sessionAbsolute);
    const absoluteExpiresAt = existingAbsoluteExpiresAt || new Date(Date.now() + absoluteSeconds * 1000);

    // Save stateful session in DB
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: payload.sub,
        refreshTokenHash: refreshHash,
        ipAddress: ipAddress || 'unknown',
        device: deviceInfo || 'unknown',
        userAgent: deviceInfo || 'unknown',
        expiresAt,
        absoluteExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(accessTokenExpires),
    };
  }

  async generateMachineToken(payload: MachineTokenPayload) {
    const accessTokenExpires = this.configService.get<string>('JWT_MACHINE_EXPIRES_IN') || '15m';

    const accessToken = await this.jwtService.signAsync(payload, {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: accessTokenExpires as any as number,
    });

    return {
      accessToken,
      expiresIn: this.parseExpiresIn(accessTokenExpires),
    };
  }

  async revokeToken(token: string, expiresIn: number): Promise<void> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = `revoked_token:${hash}`;
    await this.redisService.getClient().set(key, 'revoked', 'EX', expiresIn);
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = `revoked_token:${hash}`;
    const result = await this.redisService.getClient().get(key);
    return result === 'revoked';
  }

  async revokeSession(sessionId: string, expiresIn: number): Promise<void> {
    const key = `revoked_session:${sessionId}`;
    await this.redisService.getClient().set(key, 'revoked', 'EX', expiresIn);
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    const key = `revoked_session:${sessionId}`;
    const result = await this.redisService.getClient().get(key);
    return result === 'revoked';
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });

    const now = new Date();
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    const accessTokenExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    const expiresIn = this.parseExpiresIn(accessTokenExpires || '15m');

    for (const session of activeSessions) {
      await this.revokeSession(session.id, expiresIn);
    }
  }
}
