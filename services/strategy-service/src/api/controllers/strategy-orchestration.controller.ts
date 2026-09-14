import { Controller, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { IsUUID, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { AssignStrategyCommand } from '../../application/commands/strategy-orchestration.commands';
import { EvaluateStrategyCommand } from '../../application/commands/evaluate-strategy.command';
import { MarketIntelligenceSnapshot } from '../../domain/aggregates/strategy-orchestration.aggregate';

export class AssignStrategyDto {
  @IsUUID()
  strategyId!: string;
  @IsUUID()
  expertAdvisorId!: string;
}

export class EvaluateStrategyDto {
  @IsUUID()
  organizationId!: string;
  @IsUUID()
  marketSnapshotId!: string;
  
  @IsOptional()
  intelligence!: MarketIntelligenceSnapshot;
}

@Controller('workspaces/:workspaceId/strategy-orchestrations')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class StrategyOrchestrationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('/assign')
  async assignStrategy(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AssignStrategyDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorId = (req.user as any)?.userId || (req.user as any)?.id;
    const command = new AssignStrategyCommand(
      workspaceId,
      dto.strategyId,
      dto.expertAdvisorId,
      actorId,
    );
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Post('/evaluate')
  async evaluateStrategy(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: EvaluateStrategyDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorId = (req.user as any)?.userId || (req.user as any)?.id;
    const command = new EvaluateStrategyCommand(
      dto.organizationId,
      workspaceId,
      dto.marketSnapshotId,
      dto.intelligence,
      actorId,
    );
    await this.commandBus.execute(command);
    return { success: true };
  }
}
