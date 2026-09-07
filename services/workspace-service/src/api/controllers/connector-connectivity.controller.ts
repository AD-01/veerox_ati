import { Controller, Post, Get, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject } from 'class-validator';
import { ConnectorAuthGuard } from '../../infrastructure/auth/connector-auth.guard';
import {
  ReceiveConnectorHeartbeatCommand,
  ClaimPendingCommandCommand,
  SubmitCommandResponseCommand,
} from '../../application/commands/connector-connectivity.commands';

interface AuthenticatedMachine {
  connectorId: string;
  organizationId: string;
  workspaceId: string;
  type: string;
}

export class HeartbeatHealthDto {
  @IsOptional()
  @IsNumber()
  cpuUsage?: number;

  @IsOptional()
  @IsNumber()
  memoryUsage?: number;

  @IsOptional()
  @IsNumber()
  diskUsage?: number;

  @IsOptional()
  @IsNumber()
  networkLatency?: number;

  @IsOptional()
  @IsNumber()
  activeTerminals?: number;

  @IsOptional()
  @IsNumber()
  activeAccounts?: number;

  @IsOptional()
  @IsNumber()
  healthScore?: number;
}

export class ConnectorHeartbeatDto {
  @IsOptional()
  @IsString()
  agentVersion?: string;

  @IsOptional()
  @IsObject()
  health?: HeartbeatHealthDto;
}

export class CommandResponseDto {
  @IsString()
  @IsNotEmpty()
  responseCode!: string;

  @IsOptional()
  @IsString()
  responseMessage?: string;

  @IsOptional()
  @IsString()
  payloadJson?: string;
}

@Controller('organizations/:orgId/workspaces/:workspaceId/connectors/:id')
@UseGuards(ConnectorAuthGuard)
export class ConnectorConnectivityController {
  constructor(private readonly commandBus: CommandBus) {}

  private validateTenant(req: Request, orgId: string, workspaceId: string, connectorId: string) {
    const machine = req.user as AuthenticatedMachine;
    if (
      machine.organizationId !== orgId ||
      machine.workspaceId !== workspaceId ||
      machine.connectorId !== connectorId
    ) {
      throw new UnauthorizedException('Cross-tenant or cross-connector access is forbidden');
    }
  }

  @Post('heartbeat')
  async heartbeat(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Body() dto: ConnectorHeartbeatDto,
    @Req() req: Request,
  ) {
    this.validateTenant(req, orgId, workspaceId, connectorId);

    await this.commandBus.execute(
      new ReceiveConnectorHeartbeatCommand(
        connectorId,
        orgId,
        workspaceId,
        {
          timestamp: new Date(),
          agentVersion: dto.agentVersion ?? null,
          health: dto.health,
        },
      ),
    );

    return { success: true };
  }

  @Get('commands/pending')
  async getPendingCommands(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Req() req: Request,
  ) {
    this.validateTenant(req, orgId, workspaceId, connectorId);

    const command = await this.commandBus.execute(
      new ClaimPendingCommandCommand(connectorId, orgId, workspaceId),
    );

    return command ? { command } : { command: null };
  }

  @Post('commands/:commandId/response')
  async submitCommandResponse(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
    @Param('commandId') commandId: string,
    @Body() dto: CommandResponseDto,
    @Req() req: Request,
  ) {
    this.validateTenant(req, orgId, workspaceId, connectorId);

    await this.commandBus.execute(
      new SubmitCommandResponseCommand(
        connectorId,
        orgId,
        workspaceId,
        commandId,
        {
          responseCode: dto.responseCode,
          responseMessage: dto.responseMessage ?? null,
          payloadJson: dto.payloadJson ?? null,
        },
      ),
    );

    return { success: true };
  }
}
