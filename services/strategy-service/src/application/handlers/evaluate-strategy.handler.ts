import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { EvaluateStrategyCommand } from '../commands/evaluate-strategy.command';
import { StrategyRepository } from '../../infrastructure/repositories/strategy.repository';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';
import { StrategyOrchestration } from '../../domain/aggregates/strategy-orchestration.aggregate';
import { PrismaService } from '@veerox/database';
import { Logger } from '@nestjs/common';

@CommandHandler(EvaluateStrategyCommand)
export class EvaluateStrategyHandler implements ICommandHandler<EvaluateStrategyCommand> {
  private readonly logger = new Logger(EvaluateStrategyHandler.name);

  constructor(
    private readonly strategyRepo: StrategyRepository,
    private readonly positionRepo: OpenPositionRepository,
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: EvaluateStrategyCommand): Promise<void> {
    // 0. Idempotency Check
    const reasonPrefix = `Market intelligence update evaluation (Snapshot: ${command.snapshotId})`;
    const existingEvaluation = await this.prisma.strategyEvaluationHistory.findFirst({
      where: {
        workspaceId: command.workspaceId,
        reason: { startsWith: reasonPrefix },
      }
    });

    if (existingEvaluation) {
      this.logger.debug(`Idempotency skip: Evaluation for snapshot ${command.snapshotId} already exists in workspace ${command.workspaceId}`);
      return;
    }

    // 1. Fetch available active strategies for this organization
    const activeStrategies = await this.strategyRepo.findActiveByOrganization(command.organizationId);

    // 2. Fetch current workspace strategy evaluation to get currentStrategyId
    const lastEvaluation = await this.prisma.strategyEvaluationHistory.findFirst({
      where: { workspaceId: command.workspaceId },
      orderBy: { timestamp: 'desc' },
    });
    const currentStrategyId = lastEvaluation?.selectedStrategyId || null;

    // 3. Fetch open positions for this workspace
    const openPositions = await this.positionRepo.findByWorkspaceAndStrategy(command.workspaceId, currentStrategyId);

    // 4. Create Orchestration aggregate
    const orchestrator = this.publisher.mergeObjectContext(
      new StrategyOrchestration(command.workspaceId, currentStrategyId)
    );

    // 5. Evaluate
    const recommendedStrategy = orchestrator.evaluateAndRecommend(
      command.snapshotId,
      command.intelligence,
      activeStrategies,
      openPositions,
    );

    // 6. Save evaluation history
    await this.prisma.strategyEvaluationHistory.create({
      data: {
        workspaceId: command.workspaceId,
        candidateStrategies: JSON.stringify(activeStrategies.map(s => s.id)),
        selectedStrategyId: recommendedStrategy?.id || currentStrategyId,
        reason: reasonPrefix,
      },
    });

    // 7. Commit events (dispatches StrategyTransitionRecommendedEvent if transitioned)
    orchestrator.commit();
  }
}
