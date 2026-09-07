import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { ObservabilityModule } from '@veerox/shared/src/observability/observability.module';
import { HealthModule } from '@veerox/shared/src/health/health.module';
import { RedisModule } from '@veerox/shared/src/redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './api/controllers/auth.controller';
import { UserController } from './api/controllers/user.controller';
import { RegisterUserHandler } from './application/handlers/register-user.handler';
import { LoginHandler } from './application/handlers/login.handler';
import { AuthenticateConnectorHandler } from './application/handlers/authenticate-connector.handler';
import { LogoutHandler } from './application/handlers/logout.handler';
import { RefreshTokenHandler } from './application/handlers/refresh-token.handler';
import { GetMeHandler } from './application/handlers/get-me.handler';
import { SuspendUserHandler } from './application/handlers/suspend-user.handler';
import { ActivateUserHandler } from './application/handlers/activate-user.handler';
import { LockUserHandler } from './application/handlers/lock-user.handler';
import { UnlockUserHandler } from './application/handlers/unlock-user.handler';
import { DeleteUserHandler } from './application/handlers/delete-user.handler';
import { AssignRoleHandler } from './application/handlers/assign-role.handler';
import { RevokeRoleHandler } from './application/handlers/revoke-role.handler';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { USER_REPOSITORY } from './application/ports/user.repository.interface';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { TokenService } from './infrastructure/auth/token.service';

const CommandHandlers = [
  RegisterUserHandler,
  LoginHandler,
  LogoutHandler,
  RefreshTokenHandler,
  SuspendUserHandler,
  ActivateUserHandler,
  LockUserHandler,
  UnlockUserHandler,
  DeleteUserHandler,
  AssignRoleHandler,
  RevokeRoleHandler,
  AuthenticateConnectorHandler,
];
const QueryHandlers = [GetMeHandler];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule,
    ObservabilityModule,
    HealthModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET configuration is missing');
        
        const expiresIn = configService.get<string>('JWT_ACCESS_EXPIRES_IN');
        if (!expiresIn) throw new Error('JWT_ACCESS_EXPIRES_IN configuration is missing');

        return {
          secret,
          signOptions: {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: expiresIn as any as number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, UserController],
  providers: [
    PrismaService,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: AUDIT_REPOSITORY,
      useClass: PrismaAuditRepository,
    },
    ...CommandHandlers,
    ...QueryHandlers,
    JwtStrategy,
    JwtAuthGuard,
    TokenService,
  ],
})
export class AppModule {}
