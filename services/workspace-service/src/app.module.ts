import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';

import { CreateWorkspaceHandler } from './application/handlers/create-workspace.handler';
import { ArchiveWorkspaceHandler } from './application/handlers/archive-workspace.handler';
import { UpdateWorkspaceSettingsHandler } from './application/handlers/update-workspace-settings.handler';
import { RestoreWorkspaceHandler } from './application/handlers/restore-workspace.handler';
import { DeleteWorkspaceHandler } from './application/handlers/delete-workspace.handler';
import { AddWorkspaceMemberHandler } from './application/handlers/add-workspace-member.handler';
import { RemoveWorkspaceMemberHandler } from './application/handlers/remove-workspace-member.handler';
import { UpdateWorkspaceMemberRoleHandler } from './application/handlers/update-workspace-member-role.handler';

import { GetWorkspaceHandler, ListWorkspacesHandler, ListWorkspaceMembersHandler, GetWorkspaceMemberHandler } from './application/queries/workspace.query-handlers';

import { CreateConnectorHandler, UpdateConnectorHandler, ArchiveConnectorHandler, IssueConnectorCommandHandler } from './application/handlers/connector/connector.command-handlers';
import { ProvisionConnectorCredentialHandler, RotateConnectorCredentialHandler, RevokeConnectorCredentialHandler } from './application/handlers/connector/connector-credential.command-handlers';
import { GetConnectorHandler, ListConnectorsHandler } from './application/handlers/connector/connector.query-handlers';

import { CreateTradingAccountHandler, UpdateTradingAccountHandler, ArchiveTradingAccountHandler, DeleteTradingAccountHandler, UpdateAccountStatisticsHandler, SyncOpenPositionsHandler } from './application/handlers/trading-account/trading-account.command-handlers';
import { GetTradingAccountHandler, ListTradingAccountsHandler } from './application/handlers/trading-account/trading-account.query-handlers';

import { PrismaWorkspaceRepository } from './infrastructure/repositories/prisma-workspace.repository';
import { PrismaConnectorRepository } from './infrastructure/repositories/prisma-connector.repository';
import { PrismaTradingAccountRepository } from './infrastructure/repositories/prisma-trading-account.repository';
import { WORKSPACE_REPOSITORY } from './domain/repositories/workspace.repository.interface';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';

import { TokenService } from './infrastructure/auth/token.service';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { RedisService } from '@veerox/shared/src/redis/redis.service';

import { ReceiveConnectorHeartbeatHandler, ClaimPendingCommandHandler, SubmitCommandResponseHandler, CheckStaleConnectorsHandler } from './application/handlers/connector-connectivity/connector-connectivity.command-handlers';

const CommandHandlers = [
  CreateWorkspaceHandler,
  ArchiveWorkspaceHandler,
  UpdateWorkspaceSettingsHandler,
  RestoreWorkspaceHandler,
  DeleteWorkspaceHandler,
  AddWorkspaceMemberHandler,
  RemoveWorkspaceMemberHandler,
  UpdateWorkspaceMemberRoleHandler,
  CreateConnectorHandler,
  UpdateConnectorHandler,
  ArchiveConnectorHandler,
  IssueConnectorCommandHandler,
  CreateTradingAccountHandler,
  UpdateTradingAccountHandler,
  ArchiveTradingAccountHandler,
  DeleteTradingAccountHandler,
  UpdateAccountStatisticsHandler,
  SyncOpenPositionsHandler,
  ProvisionConnectorCredentialHandler,
  RotateConnectorCredentialHandler,
  RevokeConnectorCredentialHandler,
  ReceiveConnectorHeartbeatHandler,
  ClaimPendingCommandHandler,
  SubmitCommandResponseHandler,
  CheckStaleConnectorsHandler,
];

const QueryHandlers = [
  GetWorkspaceHandler,
  ListWorkspacesHandler,
  ListWorkspaceMembersHandler,
  GetWorkspaceMemberHandler,
  GetConnectorHandler,
  ListConnectorsHandler,
  GetTradingAccountHandler,
  ListTradingAccountsHandler,
];

const Repositories = [
  {
    provide: WORKSPACE_REPOSITORY,
    useClass: PrismaWorkspaceRepository,
  },
  {
    provide: AUDIT_REPOSITORY,
    useClass: PrismaAuditRepository,
  },
  PrismaConnectorRepository,
  PrismaTradingAccountRepository,
];

import { WorkspaceController } from './api/controllers/workspace.controller';
import { ConnectorController } from './api/controllers/connector.controller';
import { TradingAccountController } from './api/controllers/trading-account.controller';
import { ConnectorConnectivityController } from './api/controllers/connector-connectivity.controller';

@Module({
  imports: [
    ObservabilityModule,
    CqrsModule,
    ConfigModule,
  ],
  controllers: [WorkspaceController, ConnectorController, TradingAccountController, ConnectorConnectivityController],
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

