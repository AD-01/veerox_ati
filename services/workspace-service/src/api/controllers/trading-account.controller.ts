import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { IsString, IsNotEmpty, IsUUID, IsBoolean, IsOptional, IsNumber } from 'class-validator';

import {
  CreateTradingAccountCommand,
  UpdateTradingAccountCommand,
  ArchiveTradingAccountCommand,
  UpdateAccountStatisticsCommand,
} from '../../application/commands/trading-account.commands';
import {
  GetTradingAccountQuery,
  ListTradingAccountsQuery,
} from '../../application/queries/trading-account.queries';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { 
  OrganizationManageAccess, 
  OrganizationReadAccess, 
  WorkspaceManageAccess, 
  WorkspaceReadAccess 
} from '@veerox/shared';

interface AuthenticatedUser {
  userId: string;
}

export class CreateTradingAccountDto {
  @IsUUID()
  @IsNotEmpty()
  connectorId!: string;

  @IsString()
  @IsNotEmpty()
  brokerName!: string;

  @IsString()
  @IsNotEmpty()
  brokerServer!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @IsString()
  @IsNotEmpty()
  accountType!: string;

  @IsString()
  @IsNotEmpty()
  leverage!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  platform!: string;

  @IsString()
  @IsNotEmpty()
  terminalVersion!: string;
}

export class UpdateTradingAccountDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsBoolean()
  @IsOptional()
  tradingEnabled?: boolean;
}

export class UpdateAccountStatisticsDto {
  @IsNumber()
  @IsNotEmpty()
  balance!: number;

  @IsNumber()
  @IsNotEmpty()
  equity!: number;

  @IsNumber()
  @IsNotEmpty()
  margin!: number;

  @IsNumber()
  @IsNotEmpty()
  freeMargin!: number;

  @IsNumber()
  @IsNotEmpty()
  drawdown!: number;

  @IsNumber()
  @IsNotEmpty()
  floatingProfit!: number;
}

@Controller('organizations/:orgId/workspaces/:workspaceId/trading-accounts')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class TradingAccountController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @WorkspaceManageAccess()
  async createTradingAccount(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateTradingAccountDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    const accountId = await this.commandBus.execute(
      new CreateTradingAccountCommand(
        orgId,
        workspaceId,
        dto.connectorId,
        dto.brokerName,
        dto.brokerServer,
        dto.accountNumber,
        dto.accountName,
        dto.accountType,
        dto.leverage,
        dto.currency,
        dto.platform,
        dto.terminalVersion,
        user.userId,
      ),
    );
    
    return { id: accountId };
  }

  @Get()
  @WorkspaceReadAccess()
  async listTradingAccounts(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.queryBus.execute(new ListTradingAccountsQuery(orgId, workspaceId));
  }

  @Get(':id')
  @WorkspaceReadAccess()
  async getTradingAccount(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') accountId: string,
  ) {
    return this.queryBus.execute(
      new GetTradingAccountQuery(accountId, orgId, workspaceId),
    );
  }

  @Put(':id')
  @WorkspaceManageAccess()
  async updateTradingAccount(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') accountId: string,
    @Body() dto: UpdateTradingAccountDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new UpdateTradingAccountCommand(
        accountId,
        orgId,
        workspaceId,
        dto,
        user.userId,
      ),
    );
    
    return { success: true };
  }

  @Delete(':id')
  @WorkspaceManageAccess()
  async archiveTradingAccount(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') accountId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new ArchiveTradingAccountCommand(accountId, orgId, workspaceId, user.userId),
    );
    
    return { success: true };
  }

  @Put(':id/statistics')
  @WorkspaceManageAccess()
  async updateStatistics(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') accountId: string,
    @Body() dto: UpdateAccountStatisticsDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    
    await this.commandBus.execute(
      new UpdateAccountStatisticsCommand(
        accountId,
        orgId,
        workspaceId,
        dto.balance,
        dto.equity,
        dto.margin,
        dto.freeMargin,
        dto.drawdown,
        dto.floatingProfit,
        user.userId,
      ),
    );
    
    return { success: true };
  }
}
