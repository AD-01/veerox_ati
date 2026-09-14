import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AIRecommendationExecutionRequestedEvent } from '@veerox/events';
import { EvaluateRiskCommand } from '../../commands/risk-assessment/evaluate-risk.command';
import { PrismaService } from '@veerox/database';

@EventsHandler(AIRecommendationExecutionRequestedEvent)
export class AIRecommendationExecutionRequestedEventHandler implements IEventHandler<AIRecommendationExecutionRequestedEvent> {
  private readonly logger = new Logger(AIRecommendationExecutionRequestedEventHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService
  ) {}

  async handle(event: AIRecommendationExecutionRequestedEvent) {
    this.logger.log(`Received AI Recommendation Execution Requested ${event.correlationId} for risk evaluation.`);

    // For AI recommendations, we need an active trading account in the workspace
    const account = await this.prisma.tradingAccount.findFirst({
      where: { workspaceId: event.workspaceId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!account) {
      this.logger.error(`No active trading account found for workspace ${event.workspaceId} to process AI recommendation ${event.recommendationId}`);
      return;
    }

    let direction: 'LONG' | 'SHORT';
    if (event.suggestedSide === 'BUY') {
      direction = 'LONG';
    } else if (event.suggestedSide === 'SELL') {
      direction = 'SHORT';
    } else {
      throw new Error(`Invalid suggestedSide for execution: ${event.suggestedSide}`);
    }

    const command = new EvaluateRiskCommand(
      event.workspaceId,
      account.id,
      event.symbolId,
      undefined, // No strategyId for AI execution
      direction,
      event.suggestedSize,
      'system-ai', // actorId
      event.correlationId,
      undefined, 
      undefined
    );

    try {
      await this.commandBus.execute(command);
      this.logger.log(`Successfully evaluated risk for AI recommendation ${event.correlationId}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to evaluate risk for AI recommendation ${event.correlationId}: ${err.message}`, err.stack);
    }
  }
}
