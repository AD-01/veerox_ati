import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { WorkspaceReadAccess } from '@veerox/shared';
import { GetWorkspaceMarketQuotesQuery } from '../../application/queries/get-workspace-market-quotes.query';

@Controller('workspaces/:workspaceId/market/quotes')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class MarketQuotesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @WorkspaceReadAccess()
  async getWorkspaceQuotes(@Param('workspaceId') workspaceId: string) {
    const quotes = await this.queryBus.execute(new GetWorkspaceMarketQuotesQuery(workspaceId));
    return quotes;
  }
}
