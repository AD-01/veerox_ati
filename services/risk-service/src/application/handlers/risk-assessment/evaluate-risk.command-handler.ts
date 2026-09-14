import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { EvaluateRiskCommand } from '../../commands/risk-assessment/evaluate-risk.command';
import { RISK_PROFILE_REPOSITORY, IRiskProfileRepository } from '../../ports/risk-profile.repository.interface';
import { AUDIT_REPOSITORY, IAuditRepository } from '../../ports/audit.repository.interface';
import { RiskAssessment } from '../../../domain/aggregates/risk-assessment.aggregate';
import { RiskScore } from '../../../domain/entities/risk-score.value-object';
import { RiskCalculationService } from '../../../domain/services/risk-calculation.service';
import * as crypto from 'crypto';
import { PortfolioState, MarketSnapshot, ProposedTrade } from '../../../domain/interfaces/calculation-inputs.interface';
import { PrismaService } from '@veerox/database';
import { createHistogram, performance } from 'perf_hooks';

export const PORTFOLIO_READ_MODEL_REPOSITORY = 'PORTFOLIO_READ_MODEL_REPOSITORY';
export const MARKET_READ_MODEL_REPOSITORY = 'MARKET_READ_MODEL_REPOSITORY';
export const RISK_ASSESSMENT_REPOSITORY = 'RISK_ASSESSMENT_REPOSITORY';

export interface IPortfolioReadModelRepository {
  getPortfolioState(workspaceId: string, accountId: string): Promise<PortfolioState | null>;
}
export interface IMarketReadModelRepository {
  getMarketSnapshot(symbolId: string): Promise<MarketSnapshot | null>;
}
export interface IRiskAssessmentRepository {
  save(assessment: RiskAssessment): Promise<void>;
  findByCorrelationId(correlationId: string): Promise<RiskAssessment | null>;
}

const slaHistogram = createHistogram();

@CommandHandler(EvaluateRiskCommand)
export class EvaluateRiskCommandHandler implements ICommandHandler<EvaluateRiskCommand> {
  private readonly logger = new Logger(EvaluateRiskCommandHandler.name);

  constructor(
    @Inject(RISK_PROFILE_REPOSITORY)
    private readonly riskProfileRepo: IRiskProfileRepository,
    @Inject(PORTFOLIO_READ_MODEL_REPOSITORY)
    private readonly portfolioRepo: IPortfolioReadModelRepository,
    @Inject(MARKET_READ_MODEL_REPOSITORY)
    private readonly marketRepo: IMarketReadModelRepository,
    @Inject(RISK_ASSESSMENT_REPOSITORY)
    private readonly assessmentRepo: IRiskAssessmentRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: IAuditRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly calculationService: RiskCalculationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: EvaluateRiskCommand): Promise<RiskAssessment> {
    const startMark = performance.now();

    // 1. Idempotency check (Application Level)
    if (command.correlationId) {
      const existing = await this.assessmentRepo.findByCorrelationId(command.correlationId);
      if (existing) {
        return existing;
      }
    }

    // 2. Tenant & Cross-Object Verification
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: command.workspaceId },
      include: {
        members: { where: { userId: command.actorId } },
      }
    });

    if (!workspace) throw new UnauthorizedException('Workspace not found');
    if (workspace.members.length === 0 && command.actorId !== 'system') {
        throw new ForbiddenException('Actor does not belong to workspace');
    }

    const organizationId = workspace.organizationId;

    const [account, strategy] = await Promise.all([
      this.prisma.tradingAccount.findUnique({ where: { id: command.accountId } }),
      command.strategyId 
        ? this.prisma.strategy.findUnique({ where: { id: command.strategyId } })
        : Promise.resolve(null),
    ]);

    if (!account || account.workspaceId !== command.workspaceId) {
      throw new ForbiddenException('Trading account does not belong to this workspace');
    }
    if (command.strategyId && (!strategy || strategy.organizationId !== organizationId)) {
      throw new ForbiddenException('Strategy does not belong to this organization');
    }

    // 3. Load Context Data
    const [profile, portfolioState, marketSnapshot] = await Promise.all([
      this.riskProfileRepo.findByWorkspaceId(command.workspaceId),
      this.portfolioRepo.getPortfolioState(command.workspaceId, command.accountId),
      this.marketRepo.getMarketSnapshot(command.symbolId),
    ]);

    let riskScoreValue = 100;
    let decisionOutcome = 'REJECTED';
    let permittedSize = null;

    const inputsJson = JSON.stringify({ portfolioState, marketSnapshot, command });
    const policiesJson = JSON.stringify(profile);

    // 4. Fail-Closed Calculation
    if (profile && portfolioState && marketSnapshot) {
      const proposedTrade: ProposedTrade = {
        symbolId: command.symbolId,
        direction: command.tradeDirection,
        size: command.requestedSize,
        stopLoss: command.stopLoss,
        takeProfit: command.takeProfit
      };

      const calculationResult = this.calculationService.evaluateRisk(
        portfolioState,
        marketSnapshot,
        proposedTrade,
        profile
      );

      riskScoreValue = calculationResult.riskScore.value;
      decisionOutcome = calculationResult.decisionOutcome;
      permittedSize = calculationResult.permittedSize;
    }

    // 5. Create Aggregate
    let assessment = RiskAssessment.generate(
      crypto.randomUUID(),
      organizationId,
      command.workspaceId,
      command.correlationId || null,
      RiskScore.create(riskScoreValue),
      decisionOutcome,
      permittedSize,
      inputsJson,
      policiesJson,
      new Date()
    );

    assessment = this.eventPublisher.mergeObjectContext(assessment);

    // 6. Persist with Idempotency Protection
    try {
      await this.assessmentRepo.save(assessment);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002' && command.correlationId) {
        // Concurrent duplicate evaluation race condition handled deterministically
        const existing = await this.assessmentRepo.findByCorrelationId(command.correlationId);
        if (existing) return existing;
      }
      throw error;
    }

    // 7. Audit
    await this.auditRepo.log({
      actorId: command.actorId,
      targetEntityId: assessment.id,
      targetEntityType: 'RiskAssessment',
      organizationId,
      workspaceId: command.workspaceId,
      action: 'RISK_ASSESSMENT_GENERATED',
      newState: JSON.stringify({ riskScore: riskScoreValue, decisionOutcome }),
    });

    // 8. Commit Events
    assessment.commit();

    // 9. SLA Tracking
    const durationMs = performance.now() - startMark;
    slaHistogram.record(Math.ceil(durationMs));

    if (durationMs > 100) {
      this.logger.warn(`SLA Violation: Risk eval took ${durationMs.toFixed(2)}ms (P50: ${slaHistogram.percentile(50)}ms, P95: ${slaHistogram.percentile(95)}ms, P99: ${slaHistogram.percentile(99)}ms)`);
    }

    return assessment;
  }
}
