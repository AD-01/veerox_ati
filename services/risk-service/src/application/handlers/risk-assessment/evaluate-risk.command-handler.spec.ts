import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { EventPublisher } from '@nestjs/cqrs';
import { EvaluateRiskCommandHandler, PORTFOLIO_READ_MODEL_REPOSITORY, MARKET_READ_MODEL_REPOSITORY, RISK_ASSESSMENT_REPOSITORY } from './evaluate-risk.command-handler';
import { RISK_PROFILE_REPOSITORY } from '../../ports/risk-profile.repository.interface';
import { AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';
import { EvaluateRiskCommand } from '../../commands/risk-assessment/evaluate-risk.command';
import { RiskCalculationService } from '../../../domain/services/risk-calculation.service';
import { RiskProfile } from '../../../domain/aggregates/risk-profile.aggregate';

describe('EvaluateRiskCommandHandler', () => {
  let handler: EvaluateRiskCommandHandler;
  let riskProfileRepo: Record<string, jest.Mock>;
  let portfolioRepo: Record<string, jest.Mock>;
  let marketRepo: Record<string, jest.Mock>;
  let assessmentRepo: Record<string, jest.Mock>;
  let auditRepo: Record<string, jest.Mock>;
  let prismaService: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prismaService = {
      workspace: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org', members: [{ userId: 'actor' }] }) },
      tradingAccount: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'ws' }) },
      strategy: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org' }) },
    };
    riskProfileRepo = { findByWorkspaceId: jest.fn() };
    portfolioRepo = { getPortfolioState: jest.fn() };
    marketRepo = { getMarketSnapshot: jest.fn() };
    assessmentRepo = { findByCorrelationId: jest.fn(), save: jest.fn() };
    auditRepo = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluateRiskCommandHandler,
        RiskCalculationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RISK_PROFILE_REPOSITORY, useValue: riskProfileRepo },
        { provide: PORTFOLIO_READ_MODEL_REPOSITORY, useValue: portfolioRepo },
        { provide: MARKET_READ_MODEL_REPOSITORY, useValue: marketRepo },
        { provide: RISK_ASSESSMENT_REPOSITORY, useValue: assessmentRepo },
        { provide: AUDIT_REPOSITORY, useValue: auditRepo },
        {
          provide: EventPublisher,
          useValue: {
            mergeObjectContext: jest.fn().mockImplementation((obj) => {
              obj.commit = jest.fn();
              return obj;
            }),
          },
        },
      ],
    }).compile();

    handler = module.get<EvaluateRiskCommandHandler>(EvaluateRiskCommandHandler);
  });

  it('should return existing assessment if correlationId matches', async () => {
    assessmentRepo.findByCorrelationId.mockResolvedValue({ id: 'existing' });
    const command = new EvaluateRiskCommand('ws', 'strat', 'acc', 'sym', 'LONG', 1, 'actor', 'corr-1');
    
    const result = await handler.execute(command);
    expect(result).toEqual({ id: 'existing' });
    expect(portfolioRepo.getPortfolioState).not.toHaveBeenCalled();
  });

  it('should evaluate risk and log audit correctly', async () => {
    assessmentRepo.findByCorrelationId.mockResolvedValue(null);
    riskProfileRepo.findByWorkspaceId.mockResolvedValue(
      new RiskProfile('id', 'org', 'ws', 5, 20, 10, 5, 50, 'ACTIVE')
    );
    portfolioRepo.getPortfolioState.mockResolvedValue({
      balance: 10000, equity: 10000, margin: 1000, freeMargin: 9000, peakEquity: 10000, openPositions: []
    });
    marketRepo.getMarketSnapshot.mockResolvedValue({
      volatility: 0.05, regime: 'TRENDING', liquidityScore: 90, currentPrice: 1.0, contractSize: 100000, correlationMatrix: {}
    });

    const command = new EvaluateRiskCommand('ws', 'strat', 'acc', 'sym', 'LONG', 1, 'actor');
    
    const assessment = await handler.execute(command);

    expect(assessmentRepo.save).toHaveBeenCalled();
    expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({
      targetEntityType: 'RiskAssessment',
      action: 'RISK_ASSESSMENT_GENERATED',
    }));
    
    expect(assessment.getDecisionOutcome()).toBe('REJECTED');
    expect(assessment.getRiskScore().value).toBeGreaterThan(0);
  });
});
