import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { GenerateDecisionCommand } from '../commands/generate-decision.command';
import { DecisionAggregate } from '../../domain/aggregates/decision.aggregate';
import { DecisionScoringService } from '../../domain/services/decision-scoring.service';
import { PrismaService } from '@veerox/database';
import { DECISION_REPOSITORY, IDecisionRepository } from '../../infrastructure/repositories/decision.repository';
import { performance, createHistogram } from 'perf_hooks';

export const MARKET_READ_MODEL_REPOSITORY = 'MARKET_READ_MODEL_REPOSITORY';
export const AUDIT_REPOSITORY = 'AUDIT_REPOSITORY';

export interface MarketSnapshot {
  marketHealthScore: number;
  confidenceScore: number;
  regime: string;
  timestamp: string | Date;
}

export interface RiskEvaluationParams {
  workspaceId: string;
  actorId: string;
  accountId: string;
  strategyId: string;
  symbolId: string;
  tradeDirection: string;
  requestedSize: number;
  stopLoss: number | null;
  takeProfit: number | null;
  correlationId: string;
}

export interface AuditData {
  actorId: string;
  targetEntityId: string;
  targetEntityType: string;
  organizationId: string;
  workspaceId: string;
  action: string;
  previousState: string | null;
  newState: string;
}

export interface IMarketReadModelRepository {
  getMarketSnapshot(symbolId: string): Promise<MarketSnapshot | null>;
}

export interface IAuditRepository {
  log(auditData: AuditData): Promise<void>;
}

const slaHistogram = createHistogram();

@CommandHandler(GenerateDecisionCommand)
export class GenerateDecisionCommandHandler implements ICommandHandler<GenerateDecisionCommand> {
  private readonly logger = new Logger(GenerateDecisionCommandHandler.name);

  constructor(
    @Inject(DECISION_REPOSITORY)
    private readonly decisionRepo: IDecisionRepository,
    @Inject(MARKET_READ_MODEL_REPOSITORY)
    private readonly marketRepo: IMarketReadModelRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: IAuditRepository,
    private readonly scoringService: DecisionScoringService,
    private readonly eventPublisher: EventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: GenerateDecisionCommand): Promise<DecisionAggregate> {
    const startMark = performance.now();

    // 1. Idempotency Check
    const existing = await this.decisionRepo.findByCorrelationId(command.correlationId);
    if (existing) {
      return existing;
    }

    // 2. Tenant & Cross-Object Verification
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: command.workspaceId },
      include: {
        members: { where: { userId: command.actorId } },
      }
    });

    if (!workspace) throw new UnauthorizedException('Workspace not found');
    if (workspace.members.length === 0) {
      throw new ForbiddenException('Actor does not belong to workspace');
    }

    const organizationId = workspace.organizationId;

    const [account, strategy] = await Promise.all([
      this.prisma.tradingAccount.findUnique({ where: { id: command.accountId } }),
      this.prisma.strategy.findUnique({ where: { id: command.strategyId } }),
    ]);

    if (!account || account.workspaceId !== command.workspaceId) {
      throw new ForbiddenException('Trading account does not belong to this workspace');
    }
    if (!strategy || strategy.organizationId !== organizationId) {
      throw new ForbiddenException('Strategy does not belong to this organization');
    }

    // 3. Assemble Context
    let marketSnapshot = null;
    let strategyMetrics = null;
    let dataQuality: 'HIGH' | 'LOW' = 'HIGH';

    try {
      [marketSnapshot, strategyMetrics] = await Promise.all([
        this.marketRepo.getMarketSnapshot(command.symbolId),
        this.prisma.strategyMetricsReadModel.findUnique({
          where: { strategyId: command.strategyId },
        })
      ]);
      
      // Check freshness of market data (Stale-data handling)
      if (marketSnapshot && (Date.now() - new Date(marketSnapshot.timestamp).getTime()) > 60000) {
        dataQuality = 'LOW';
      }

    } catch (err) {
      this.logger.error('Failed to assemble decision context', err);
      dataQuality = 'LOW';
    }

    if (!marketSnapshot || !strategyMetrics) {
      dataQuality = 'LOW';
    }

    // 4. Scoring
    const scoringResult = this.scoringService.evaluate({
      marketHealthScore: marketSnapshot?.marketHealthScore || 0,
      marketConfidence: marketSnapshot?.confidenceScore || 0,
      marketRegime: marketSnapshot?.regime || 'UNKNOWN',
      strategyConfidence: strategyMetrics ? Number(strategyMetrics.confidenceScore) : 0,
      strategyMatched: true,
      riskScore: command.riskScore,
      dataQuality,
      historicalPerformance: (strategyMetrics?.historicalPerformance as 'HIGH' | 'LOW') || 'LOW'
    });

    const context = {
      marketSnapshot,
      riskScore: command.riskScore,
      command
    };

    // 5. Generate Aggregate
    let decision = DecisionAggregate.generate(
      organizationId,
      command.workspaceId,
      command.correlationId,
      command.strategyId,
      command.accountId,
      command.symbolId,
      scoringResult.outcome,
      scoringResult.confidenceScore,
      scoringResult.explanation,
      context
    );

    decision = this.eventPublisher.mergeObjectContext(decision);

    // 6. Persist with Idempotency Protection
    try {
      await this.decisionRepo.save(decision);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err?.code === 'P2002') {
        const existingDecision = await this.decisionRepo.findByCorrelationId(command.correlationId);
        if (existingDecision) return existingDecision;
      }
      throw error;
    }

    // 7. Audit
    await this.auditRepo.log({
      actorId: command.actorId,
      targetEntityId: decision.id,
      targetEntityType: 'Decision',
      organizationId,
      workspaceId: command.workspaceId,
      action: 'DECISION_GENERATED',
      previousState: null,
      newState: JSON.stringify({ outcome: decision.outcome, confidence: decision.confidenceScore }),
    });

    // 8. Commit Events
    decision.commit();

    // 9. SLA Tracking
    const durationMs = performance.now() - startMark;
    slaHistogram.record(Math.ceil(durationMs));

    if (durationMs > 100) {
      this.logger.warn(`SLA Violation: Decision eval took ${durationMs.toFixed(2)}ms (P50: ${slaHistogram.percentile(50)}ms, P95: ${slaHistogram.percentile(95)}ms, P99: ${slaHistogram.percentile(99)}ms)`);
    }

    return decision;
  }
}
