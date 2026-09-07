import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RiskAssessmentController } from './risk-assessment.controller';
import { EvaluateRiskDto } from '../dtos/evaluate-risk.dto';
import { RiskAssessment } from '../../domain/aggregates/risk-assessment.aggregate';
import { RiskScore } from '../../domain/entities/risk-score.value-object';
import { PositionSize } from '../../domain/entities/position-size.value-object';
import { GetRiskAssessmentsQuery } from '../../application/queries/risk-assessment/get-risk-assessments.query';

describe('RiskAssessmentController', () => {
  let controller: RiskAssessmentController;
  let commandBus: Record<string, jest.Mock>;
  let queryBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskAssessmentController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
      ],
    }).compile();

    controller = module.get<RiskAssessmentController>(RiskAssessmentController);
  });

  it('should dispatch EvaluateRiskCommand and return dto', async () => {
    const riskScore = RiskScore.create(50);
    const size = PositionSize.create(1.0);
    
    const mockAssessment = RiskAssessment.generate(
      'id-1', 'org', 'ws', 'corr', riskScore, 'APPROVED', size, '{}', '{}', new Date()
    );
    
    commandBus.execute.mockResolvedValue(mockAssessment);

    const dto: EvaluateRiskDto = {
      strategyId: 'strat',
      accountId: 'acc',
      symbolId: 'sym',
      tradeDirection: 'LONG',
      requestedSize: 1.0
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { user: { id: 'test-user' } };

    const result = await controller.evaluateRisk('ws', dto, req);

    expect(commandBus.execute).toHaveBeenCalled();
    expect(result.id).toBe('id-1');
    expect(result.decisionOutcome).toBe('APPROVED');
    expect(result.riskScore).toBe(50);
  });

  it('should dispatch GetRiskAssessmentsQuery', async () => {
    queryBus.execute.mockResolvedValue([{ id: 'id-1' }]);

    const result = await controller.getAssessments('ws', 10, 0);
    
    expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetRiskAssessmentsQuery));
    expect(result).toHaveLength(1);
  });
});
