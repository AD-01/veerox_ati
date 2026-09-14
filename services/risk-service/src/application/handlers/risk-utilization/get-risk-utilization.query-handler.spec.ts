import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { NotFoundException } from '@nestjs/common';
import { GetRiskUtilizationQueryHandler } from './get-risk-utilization.query-handler';
import { GetRiskUtilizationQuery } from '../../queries/risk-utilization/get-risk-utilization.query';

const mockPrismaService = {
  tradingAccount: {
    findFirst: jest.fn(),
  },
  riskProfile: {
    findUnique: jest.fn(),
  },
  accountStatistics: {
    findFirst: jest.fn(),
  },
  riskAssessment: {
    findFirst: jest.fn(),
  },
};

describe('GetRiskUtilizationQueryHandler', () => {
  let handler: GetRiskUtilizationQueryHandler;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRiskUtilizationQueryHandler,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    handler = module.get<GetRiskUtilizationQueryHandler>(GetRiskUtilizationQueryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const workspaceId = 'ws-1';
  const accountId = 'acc-1';

  it('should return risk utilization correctly when all data is present', async () => {
    const now = new Date();
    
    prisma.tradingAccount.findFirst.mockResolvedValue({
      id: accountId,
      workspaceId,
      marginUsed: { toNumber: () => 100 },
      equity: { toNumber: () => 1000 },
    });

    prisma.riskProfile.findUnique.mockResolvedValue({
      workspaceId,
      maxDrawdown: { toNumber: () => 20 },
      marginThreshold: { toNumber: () => 50 },
      maxDailyLoss: { toNumber: () => 5 },
      maxPositionSize: { toNumber: () => 200 },
    });

    prisma.accountStatistics.findFirst.mockResolvedValue({
      accountId,
      drawdown: { toNumber: () => 10 },
      snapshotTime: now,
    });

    prisma.riskAssessment.findFirst.mockResolvedValue({
      workspaceId,
      riskScore: 45,
      decisionOutcome: 'APPROVED',
      timestamp: now,
    });

    const result = await handler.execute(new GetRiskUtilizationQuery(workspaceId, accountId));

    expect(result).toEqual({
      accountId,
      workspaceId,
      timestamp: now,
      drawdown: {
        current: 10,
        limit: 20,
      },
      margin: {
        currentUsed: 100,
        currentEquity: 1000,
        limitThreshold: 50,
      },
      dailyLoss: {
        limit: 5,
      },
      exposure: {
        limit: 200,
      },
      riskScore: 45,
      decisionOutcome: 'APPROVED',
    });
    
    // Verify it doesn't fabricate fields
    expect((result as any).dailyLoss.current).toBeUndefined();
    expect((result as any).exposure.current).toBeUndefined();
  });

  it('should fall back to 0 and UNKNOWN if risk assessment is missing', async () => {
    prisma.tradingAccount.findFirst.mockResolvedValue({
      id: accountId,
      workspaceId,
      marginUsed: { toNumber: () => 100 },
      equity: { toNumber: () => 1000 },
    });

    prisma.riskProfile.findUnique.mockResolvedValue({
      workspaceId,
      maxDrawdown: { toNumber: () => 20 },
      marginThreshold: { toNumber: () => 50 },
      maxDailyLoss: { toNumber: () => 5 },
      maxPositionSize: { toNumber: () => 200 },
    });

    prisma.accountStatistics.findFirst.mockResolvedValue({
      accountId,
      drawdown: { toNumber: () => 10 },
      snapshotTime: new Date(),
    });

    prisma.riskAssessment.findFirst.mockResolvedValue(null);

    const result = await handler.execute(new GetRiskUtilizationQuery(workspaceId, accountId));

    expect(result.riskScore).toBe(0);
    expect(result.decisionOutcome).toBe('UNKNOWN');
  });

  it('should enforce tenant isolation by verifying account belongs to workspace', async () => {
    // If findFirst returns null, it means the account either doesn't exist or is in another workspace
    prisma.tradingAccount.findFirst.mockResolvedValue(null);

    await expect(handler.execute(new GetRiskUtilizationQuery(workspaceId, accountId)))
      .rejects
      .toThrow(NotFoundException);
  });

  it('should throw NotFoundException if risk profile is missing', async () => {
    prisma.tradingAccount.findFirst.mockResolvedValue({
      id: accountId,
      workspaceId,
      marginUsed: { toNumber: () => 100 },
      equity: { toNumber: () => 1000 },
    });

    prisma.riskProfile.findUnique.mockResolvedValue(null);

    await expect(handler.execute(new GetRiskUtilizationQuery(workspaceId, accountId)))
      .rejects
      .toThrow(NotFoundException);
  });
});
