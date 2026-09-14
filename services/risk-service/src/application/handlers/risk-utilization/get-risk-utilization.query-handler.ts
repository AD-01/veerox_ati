import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { RiskUtilizationDto } from '@veerox/contracts';
import { GetRiskUtilizationQuery } from '../../queries/risk-utilization/get-risk-utilization.query';

@QueryHandler(GetRiskUtilizationQuery)
export class GetRiskUtilizationQueryHandler implements IQueryHandler<GetRiskUtilizationQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetRiskUtilizationQuery): Promise<RiskUtilizationDto> {
    const { workspaceId, accountId } = query;

    // 1. Verify account belongs to workspace and get margin metrics
    const account = await this.prisma.tradingAccount.findFirst({
      where: {
        id: accountId,
        workspaceId,
      },
    });

    if (!account) {
      throw new NotFoundException(`Trading account ${accountId} not found in workspace ${workspaceId}`);
    }

    // 2. Get risk limits
    const riskProfile = await this.prisma.riskProfile.findUnique({
      where: { workspaceId },
    });

    if (!riskProfile) {
      throw new NotFoundException(`Risk profile not configured for workspace: ${workspaceId}`);
    }

    // 3. Get latest account statistics for drawdown
    const latestStats = await this.prisma.accountStatistics.findFirst({
      where: { accountId },
      orderBy: { snapshotTime: 'desc' },
    });

    // 4. Get latest risk assessment for score and outcome
    const latestAssessment = await this.prisma.riskAssessment.findFirst({
      where: { workspaceId },
      orderBy: { timestamp: 'desc' },
    });

    const timestamp = latestAssessment?.timestamp || latestStats?.snapshotTime || new Date();

    return {
      accountId,
      workspaceId,
      timestamp,

      drawdown: {
        current: latestStats ? latestStats.drawdown.toNumber() : 0,
        limit: riskProfile.maxDrawdown.toNumber(),
      },

      margin: {
        currentUsed: account.marginUsed.toNumber(),
        currentEquity: account.equity.toNumber(),
        limitThreshold: riskProfile.marginThreshold.toNumber(),
      },

      dailyLoss: {
        limit: riskProfile.maxDailyLoss.toNumber(),
      },

      exposure: {
        limit: riskProfile.maxPositionSize.toNumber(),
      },

      riskScore: latestAssessment ? latestAssessment.riskScore : 0,
      decisionOutcome: latestAssessment ? latestAssessment.decisionOutcome : 'UNKNOWN',
    };
  }
}
