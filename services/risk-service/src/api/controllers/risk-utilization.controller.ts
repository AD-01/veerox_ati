import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { RiskUtilizationDto } from '@veerox/contracts';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { WorkspaceReadAccess } from '@veerox/shared';
import { GetRiskUtilizationQuery } from '../../application/queries/risk-utilization/get-risk-utilization.query';
import { PrismaService } from '@veerox/database';

@Controller('workspaces/:workspaceId/accounts/:accountId/risk-utilization')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class RiskUtilizationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @WorkspaceReadAccess()
  async getRiskUtilization(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
  ): Promise<RiskUtilizationDto> {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`TradingAccount ${accountId} not found.`);
    }
    if (account.workspaceId !== workspaceId) {
      throw new ForbiddenException('Account does not belong to the authorized workspace');
    }

    return this.queryBus.execute(new GetRiskUtilizationQuery(workspaceId, accountId));
  }
}
