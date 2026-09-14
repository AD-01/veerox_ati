import { Controller, Post, Body, Req, UseGuards, HttpException, HttpStatus, Get, Param, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { GenerateDecisionDto } from '../dtos/generate-decision.dto';
import { GenerateDecisionCommand } from '../../application/commands/generate-decision.command';
import { AtiGuard, AtiRequest } from '@veerox/shared';

@Controller('api/v1/decisions')
@UseGuards(AtiGuard)
export class DecisionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('evaluate')
  async evaluateDecision(@Req() req: AtiRequest, @Body() dto: GenerateDecisionDto) {
    const actorId = req.user?.sub;
    if (!actorId) throw new UnauthorizedException('Missing authenticated actor context');
    const workspaceId = req.workspaceId as string;
    const organizationId = req.organizationId as string;

    try {
      const command = new GenerateDecisionCommand(
        dto.correlationId,
        workspaceId,
        actorId,
        organizationId,
        dto.strategyId,
        dto.accountId,
        dto.symbolId,
        dto.tradeDirection,
        dto.requestedSize,
        dto.stopLoss || null,
        dto.takeProfit || null,
        dto.riskScore || 100
      );

      const decision = await this.commandBus.execute(command);
      
      return {
        id: decision.id,
        correlationId: decision.correlationId,
        outcome: decision.outcome,
        confidenceScore: decision.confidenceScore,
        status: decision.status,
        explanation: decision.explanation
      };
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      throw new HttpException(
        err.message || 'Internal Server Error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getDecision(@Req() req: AtiRequest, @Param('id') id: string) {
    return { id, status: 'MOCK_RESPONSE' };
  }
}
