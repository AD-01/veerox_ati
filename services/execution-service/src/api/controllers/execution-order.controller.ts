import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { GetExecutionOrdersQuery } from '../../application/queries/get-execution-orders.query';
import { SubmitManualTradeCommand } from '../../application/commands/submit-manual-trade.command';
import { SubmitManualTradeRequestDto } from '@veerox/contracts';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceReadAccess, WorkspaceManageAccess, WorkspaceAuthorizationService, WorkspaceScopeGuard, RateLimit, RateLimitGuard } from '@veerox/shared';
import { PrismaService } from '@veerox/database';

import { Request } from 'express';
import * as crypto from 'crypto';
@Controller('api/v1/execution')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class ExecutionOrderController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService
  ) {}

  @Get('workspaces/:workspaceId/orders')
  @WorkspaceReadAccess()
  async getWorkspaceOrders(
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 50;
    const skip = offset ? parseInt(offset, 10) : 0;
    return this.queryBus.execute(
      new GetExecutionOrdersQuery(workspaceId, undefined, take, skip),
    );
  }

  @Get('accounts/:accountId/orders')
  async getAccountOrders(
    @Param('accountId') accountId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`TradingAccount ${accountId} not found.`);
    }

    const user = req.user;
    if (!user || !user.userRoles) {
      throw new ForbiddenException('User context missing roles mapping');
    }
    const canRead = WorkspaceAuthorizationService.canReadWorkspace(user.userRoles, account.organizationId, account.workspaceId);
    if (!canRead) {
      throw new ForbiddenException('Insufficient workspace privileges to read');
    }

    const take = limit ? parseInt(limit, 10) : 50;
    const skip = offset ? parseInt(offset, 10) : 0;
    return this.queryBus.execute(
      new GetExecutionOrdersQuery(undefined, accountId, take, skip),
    );
  }

  @Post('workspaces/:workspaceId/accounts/:accountId/trade')
  @WorkspaceManageAccess()
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: 'rate-limit:exec:trade:user:', limit: 50, windowSeconds: 60, extractKey: 'userId', failPolicy: 'open' })
  async submitManualTrade(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Body() dto: SubmitManualTradeRequestDto,
    @Req() req: Request & { user?: any },
  ) {
    if (dto.accountId !== accountId) {
      throw new BadRequestException('Account ID in path must match body');
    }

    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: accountId },
    });
    
    if (!account || account.workspaceId !== workspaceId) {
      throw new NotFoundException(`TradingAccount ${accountId} not found in workspace.`);
    }

    const user = req.user;
    if (!user || !user.id) {
      throw new ForbiddenException('User context missing');
    }
    
    const authToken = req.headers.authorization || '';

    return this.commandBus.execute(
      new SubmitManualTradeCommand(
        workspaceId,
        account.organizationId,
        user.id,
        accountId,
        dto.symbolId,
        dto.tradeDirection,
        dto.requestedSize,
        dto.orderType,
        dto.stopLoss || null,
        dto.takeProfit || null,
        dto.clientExecutionId || crypto.randomUUID(),
        authToken,
        dto.requestedPrice || null,
        dto.maxDeviation || null,
      ),
    );
  }
}
