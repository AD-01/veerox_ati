import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRiskProfileRepository } from './prisma-risk-profile.repository';
import { PrismaService } from '@veerox/database';
import { EventPublisher } from '@nestjs/cqrs';
import { RiskProfile } from '../../domain/aggregates/risk-profile.aggregate';

describe('PrismaRiskProfileRepository', () => {
  let repository: PrismaRiskProfileRepository;
  let prismaService: { riskProfile: { findUnique: jest.Mock; upsert: jest.Mock } };
  let eventPublisher: { mergeObjectContext: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      riskProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    eventPublisher = {
      mergeObjectContext: jest.fn().mockImplementation((obj) => obj),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaRiskProfileRepository,
        { provide: PrismaService, useValue: prismaService },
        { provide: EventPublisher, useValue: eventPublisher },
      ],
    }).compile();

    repository = module.get<PrismaRiskProfileRepository>(PrismaRiskProfileRepository);
  });

  it('should return null if profile not found', async () => {
    prismaService.riskProfile.findUnique.mockResolvedValue(null);
    const result = await repository.findByWorkspaceId('ws-1');
    expect(result).toBeNull();
  });

  it('should return reconstituted aggregate if profile found', async () => {
    const data = {
      id: 'rp-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      maxDailyLoss: 5,
      maxDrawdown: 10,
      maxPositionSize: 100,
      maxOpenPositions: 5,
      marginThreshold: 20,
      status: 'ACTIVE',
    };
    prismaService.riskProfile.findUnique.mockResolvedValue(data);

    const result = await repository.findByWorkspaceId('ws-1');
    expect(result).toBeInstanceOf(RiskProfile);
    expect(result?.id).toBe('rp-1');
    expect(result?.organizationId).toBe('org-1');
  });

  it('should save the profile', async () => {
    const profile = new RiskProfile('rp-1', 'org-1', 'ws-1', 5, 10, 100, 5, 20, 'ACTIVE');
    profile.commit = jest.fn();

    await repository.save(profile);
    expect(prismaService.riskProfile.upsert).toHaveBeenCalled();
    expect(profile.commit).toHaveBeenCalled();
  });
});
