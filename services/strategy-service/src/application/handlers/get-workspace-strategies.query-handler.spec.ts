import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@veerox/database';
import { GetWorkspaceStrategiesQueryHandler } from './get-workspace-strategies.query-handler';
import { GetWorkspaceStrategiesQuery } from '../queries/get-workspace-strategies.query';
import { NotFoundException } from '@nestjs/common';

describe('GetWorkspaceStrategiesQueryHandler (S-24 Phase 07F-A)', () => {
  let handler: GetWorkspaceStrategiesQueryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceStrategiesQueryHandler,
        {
          provide: PrismaService,
          useValue: {
            workspace: { findUnique: jest.fn() },
            strategy: { findMany: jest.fn() },
            strategyOrchestration: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    handler = module.get(GetWorkspaceStrategiesQueryHandler);
    prisma = module.get(PrismaService);
  });

  it('1. should throw NotFoundException if workspace does not exist', async () => {
    jest.spyOn(prisma.workspace, 'findUnique').mockResolvedValue(null);
    await expect(handler.execute(new GetWorkspaceStrategiesQuery('ws-invalid'))).rejects.toThrow(NotFoundException);
  });

  it('2. should return empty array if no strategies exist for org', async () => {
    jest.spyOn(prisma.workspace, 'findUnique').mockResolvedValue({ organizationId: 'org-1' } as any);
    jest.spyOn(prisma.strategy, 'findMany').mockResolvedValue([]);
    const result = await handler.execute(new GetWorkspaceStrategiesQuery('ws-1'));
    expect(result).toEqual([]);
  });

  it('3. should return mapped strategies and correctly identify the current strategy', async () => {
    jest.spyOn(prisma.workspace, 'findUnique').mockResolvedValue({ organizationId: 'org-1' } as any);
    
    const strategyTime1 = new Date('2026-08-30T10:00:00Z');
    const strategyTime2 = new Date('2026-08-30T11:00:00Z');
    const orchestrationTime = new Date('2026-08-30T12:00:00Z');

    jest.spyOn(prisma.strategy, 'findMany').mockResolvedValue([
      { id: 'strat-1', name: 'Strategy 1', status: 'ACTIVE', updatedAt: strategyTime1 },
      { id: 'strat-2', name: 'Strategy 2', status: 'DRAFT', updatedAt: strategyTime2 },
    ] as any);

    jest.spyOn(prisma.strategyOrchestration, 'findUnique').mockResolvedValue({
      currentStrategyId: 'strat-1',
      updatedAt: orchestrationTime
    } as any);

    const result = await handler.execute(new GetWorkspaceStrategiesQuery('ws-1'));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      strategyId: 'strat-1',
      name: 'Strategy 1',
      status: 'ACTIVE',
      isCurrent: true,
      updatedAt: orchestrationTime, // uses orchestration time since it's current
    });
    expect(result[1]).toEqual({
      strategyId: 'strat-2',
      name: 'Strategy 2',
      status: 'DRAFT',
      isCurrent: false,
      updatedAt: strategyTime2, // uses its own time
    });
  });
});
