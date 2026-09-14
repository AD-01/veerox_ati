import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { EvaluateRiskDto } from '../dtos/evaluate-risk.dto';
import { RiskAssessmentDto } from '../dtos/risk-assessment.dto';
import { EvaluateRiskCommand } from '../../application/commands/risk-assessment/evaluate-risk.command';
import { GetRiskAssessmentsQuery } from '../../application/queries/risk-assessment/get-risk-assessments.query';
import { RiskAssessment } from '../../domain/aggregates/risk-assessment.aggregate';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';

@Controller('api/v1/risk')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class RiskAssessmentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('evaluate')
  async evaluateRisk(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: EvaluateRiskDto,
    @Req() req: Request & { user?: { id: string } }
  ): Promise<RiskAssessmentDto> {
    const actorId = req.user?.id;
    if (!actorId) throw new Error('Unauthorized');

    const command = new EvaluateRiskCommand(
      workspaceId,
      dto.accountId,
      dto.symbolId,
      dto.strategyId,
      dto.tradeDirection,
      dto.requestedSize,
      actorId,
      dto.correlationId,
      dto.stopLoss,
      dto.takeProfit
    );

    const assessment: RiskAssessment = await this.commandBus.execute(command);

    return {
      id: assessment.id,
      riskScore: assessment.getRiskScore().value,
      riskCategory: assessment.getRiskScore().category,
      decisionOutcome: assessment.getDecisionOutcome(),
      permittedSize: assessment.getPermittedSize()?.value || null,
      correlationId: assessment.correlationId,
      timestamp: assessment.timestamp,
    };
  }

  @Get('assessments')
  async getAssessments(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ): Promise<unknown[]> {
    const query = new GetRiskAssessmentsQuery(workspaceId, limit, offset);
    return this.queryBus.execute(query);
  }
}
