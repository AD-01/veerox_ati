import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { IsString, IsNotEmpty } from 'class-validator';

import {
  CreateConnectorCommand,
  UpdateConnectorCommand,
  ArchiveConnectorCommand,
  IssueConnectorCommand,
} from '../../application/commands/connector.commands';
import {
  ProvisionConnectorCredentialCommand,
  RotateConnectorCredentialCommand,
  RevokeConnectorCredentialCommand,
} from '../../application/commands/connector-credential.commands';
import {
  GetConnectorQuery,
  ListConnectorsQuery,
} from '../../application/queries/connector.queries';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '../../infrastructure/auth/workspace-scope.guard';
import {
  WorkspaceManageAccess,
  WorkspaceReadAccess,
} from '../../infrastructure/auth/decorators';

interface AuthenticatedUser {
  userId: string;
}

export class CreateConnectorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;
}

export class UpdateConnectorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class IssueConnectorCommandDto {
  @IsString()
  @IsNotEmpty()
  commandType!: string;

  @IsString()
  @IsNotEmpty()
  payloadJson!: string;
}

@Controller('organizations/:orgId/workspaces/:workspaceId/connectors')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class ConnectorController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @WorkspaceManageAccess()
  async createConnector(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateConnectorDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    const connectorId = await this.commandBus.execute(
      new CreateConnectorCommand(
        orgId,
        workspaceId,
        dto.name,
        dto.provider,
        user.userId,
      ),
    );
    
    return { id: connectorId };
  }

  @Get()
  @WorkspaceReadAccess()
  async listConnectors(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.queryBus.execute(new ListConnectorsQuery(orgId, workspaceId));
  }

  @Get(':id')
  @WorkspaceReadAccess()
  async getConnector(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
  ) {
    return this.queryBus.execute(
      new GetConnectorQuery(connectorId, orgId, workspaceId),
    );
  }

  @Put(':id')
  @WorkspaceManageAccess()
  async updateConnector(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Body() dto: UpdateConnectorDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new UpdateConnectorCommand(
        connectorId,
        orgId,
        workspaceId,
        dto.name,
        user.userId,
      ),
    );
    
    return { success: true };
  }

  @Delete(':id')
  @WorkspaceManageAccess()
  async archiveConnector(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new ArchiveConnectorCommand(connectorId, orgId, workspaceId, user.userId),
    );
    
    return { success: true };
  }

  @Post(':id/commands')
  @WorkspaceManageAccess()
  async issueCommand(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Body() dto: IssueConnectorCommandDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new IssueConnectorCommand(
        connectorId,
        orgId,
        workspaceId,
        dto.commandType,
        dto.payloadJson,
        user.userId,
      ),
    );
    
    return { success: true };
  }

  @Post(':id/credentials/provision')
  @WorkspaceManageAccess()
  async provisionCredential(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    const result = await this.commandBus.execute(
      new ProvisionConnectorCredentialCommand(
        connectorId,
        orgId,
        workspaceId,
        user.userId,
      ),
    );
    
    return { success: true, secret: result.secret };
  }

  @Post(':id/credentials/rotate')
  @WorkspaceManageAccess()
  async rotateCredential(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    const result = await this.commandBus.execute(
      new RotateConnectorCredentialCommand(
        connectorId,
        orgId,
        workspaceId,
        user.userId,
      ),
    );
    
    return { success: true, secret: result.secret };
  }

  @Post(':id/credentials/revoke')
  @WorkspaceManageAccess()
  async revokeCredential(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new RevokeConnectorCredentialCommand(
        connectorId,
        orgId,
        workspaceId,
        user.userId,
      ),
    );
    
    return { success: true };
  }
}
