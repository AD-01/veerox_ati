import { Controller, Post, Body, Get, HttpCode, HttpStatus, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LoginCommand } from '../../application/commands/login.command';
import { AuthenticateConnectorCommand } from '../../application/commands/authenticate-connector.command';
import { LogoutCommand } from '../../application/commands/logout.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token.command';
import { GetMeQuery } from '../../application/queries/get-me.query';
import { LoginDto, RefreshTokenDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '@veerox/shared';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: 'rate-limit:auth:login:', limit: 10, windowSeconds: 300, ipLimit: 50, ipWindowSeconds: 300, extractKey: 'login', failPolicy: 'closed' })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(@Req() req: any & { user?: Record<string, unknown> }, @Body() dto: LoginDto) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const command = new LoginCommand(dto.email, dto.password, ip, userAgent);
    const result = await this.commandBus.execute(command);
    return { success: true, data: result };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async refresh(@Req() req: any & { user?: Record<string, unknown> }, @Body() dto: RefreshTokenDto) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const command = new RefreshTokenCommand(dto.refreshToken, ip, userAgent);
    const result = await this.commandBus.execute(command);
    return { success: true, data: result };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async logout(@Req() req: any & { user?: Record<string, unknown> }) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await this.commandBus.execute(new LogoutCommand(token, req.user?.sessionId));
    }
    return { success: true, data: null };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async me(@Req() req: any & { user?: Record<string, unknown> }) {
    if (!req.user || !req.user.sub) {
      throw new UnauthorizedException();
    }
    const result = await this.queryBus.execute(new GetMeQuery(req.user.sub));
    return { success: true, data: result };
  }

  @Post('connector')
  @HttpCode(HttpStatus.OK)
  async authenticateConnector(@Req() req: Request, @Body() dto: { connectorId: string; clientSecret: string }) {
    if (!dto.connectorId || !dto.clientSecret) {
      throw new UnauthorizedException('Missing connector credentials');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = (req as any).ip || (req as any).connection?.remoteAddress || 'unknown';
    const command = new AuthenticateConnectorCommand(dto.connectorId, dto.clientSecret, ip);
    const result = await this.commandBus.execute(command);
    return { success: true, data: result };
  }
}
