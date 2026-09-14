import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';
import { OrganizationController } from './api/controllers/organization.controller';
import { MembershipController } from './api/controllers/membership.controller';
import { CreateOrganizationHandler } from './application/handlers/create-organization.handler';
import { UpdateOrganizationHandler } from './application/handlers/update-organization.handler';
import { ArchiveOrganizationHandler } from './application/handlers/archive-organization.handler';
import { TransferOrganizationOwnershipHandler } from './application/handlers/transfer-ownership.handler';
import { InviteMemberHandler } from './application/handlers/invite-member.handler';
import { AcceptInvitationHandler } from './application/handlers/accept-invitation.handler';
import { RemoveMemberHandler } from './application/handlers/remove-member.handler';
import { GetOrganizationHandler, ListOrganizationsHandler, GetMembersHandler, GetPendingInvitationsHandler } from './application/queries/organization.query-handlers';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-organization.repository';
import { PrismaInvitationRepository } from './infrastructure/repositories/prisma-invitation.repository';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { ORGANIZATION_REPOSITORY } from './domain/repositories/organization.repository.interface';
import { INVITATION_REPOSITORY } from './domain/repositories/invitation.repository.interface';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { TokenService } from './infrastructure/auth/token.service';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { RedisService } from '@veerox/shared/src/redis/redis.service';

const CommandHandlers = [
  CreateOrganizationHandler,
  UpdateOrganizationHandler,
  ArchiveOrganizationHandler,
  TransferOrganizationOwnershipHandler,
  InviteMemberHandler,
  AcceptInvitationHandler,
  RemoveMemberHandler,
];

const QueryHandlers = [
  GetOrganizationHandler,
  ListOrganizationsHandler,
  GetMembersHandler,
  GetPendingInvitationsHandler,
];

const Repositories = [
  {
    provide: ORGANIZATION_REPOSITORY,
    useClass: PrismaOrganizationRepository,
  },
  {
    provide: INVITATION_REPOSITORY,
    useClass: PrismaInvitationRepository,
  },
  {
    provide: AUDIT_REPOSITORY,
    useClass: PrismaAuditRepository,
  },
];

@Module({
  imports: [
    ObservabilityModule,
    CqrsModule,
    ConfigModule,
  ],
  controllers: [
    OrganizationController,
    MembershipController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
    TokenService,
    JwtStrategy,
    PrismaService,
    RedisService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

