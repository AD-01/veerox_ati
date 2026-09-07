import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { ConfigureRiskProfileHandler } from './risk-profile.command-handlers';
import { RISK_PROFILE_REPOSITORY } from '../../ports/risk-profile.repository.interface';
import { AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';
import { ConfigureRiskProfileCommand } from '../../commands/risk-profile.commands';
import { RiskProfile } from '../../../domain/aggregates/risk-profile.aggregate';

describe('ConfigureRiskProfileHandler', () => {
  let handler: ConfigureRiskProfileHandler;
  let riskProfileRepository: { findByWorkspaceId: jest.Mock; save: jest.Mock };
  let auditRepository: { log: jest.Mock };
  let prismaService: { workspaceMember: { findUnique: jest.Mock } };
  let eventPublisher: { mergeObjectContext: jest.Mock };

  beforeEach(async () => {
    riskProfileRepository = {
      findByWorkspaceId: jest.fn(),
      save: jest.fn(),
    };

    auditRepository = {
      log: jest.fn(),
    };

    prismaService = {
      workspaceMember: {
        findUnique: jest.fn(),
      },
    };

    eventPublisher = {
      mergeObjectContext: jest.fn().mockImplementation((obj) => obj),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigureRiskProfileHandler,
        { provide: RISK_PROFILE_REPOSITORY, useValue: riskProfileRepository },
        { provide: AUDIT_REPOSITORY, useValue: auditRepository },
        { provide: PrismaService, useValue: prismaService },
        { provide: EventPublisher, useValue: eventPublisher },
      ],
    }).compile();

    handler = module.get<ConfigureRiskProfileHandler>(ConfigureRiskProfileHandler);
  });

  it('should throw an error if the actor is not an active workspace member', async () => {
    prismaService.workspaceMember.findUnique.mockResolvedValue(null);
    const command = new ConfigureRiskProfileCommand('ws-1', 5, 10, 100, 2, 20, 'actor-1');

    await expect(handler.execute(command)).rejects.toThrow('Unauthorized: Actor is not an active member of workspace ws-1');
  });

  it('should create a new risk profile if one does not exist', async () => {
    prismaService.workspaceMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      workspace: { organizationId: 'org-1' }
    });
    riskProfileRepository.findByWorkspaceId.mockResolvedValue(null);

    const command = new ConfigureRiskProfileCommand('ws-1', 5, 10, 100, 2, 20, 'actor-1');
    await handler.execute(command);

    expect(riskProfileRepository.save).toHaveBeenCalled();
    const savedProfile = riskProfileRepository.save.mock.calls[0][0];
    expect(savedProfile.organizationId).toBe('org-1');
    expect(savedProfile.getMaxDailyLoss()).toBe(5);
    expect(auditRepository.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      targetEntityId: expect.any(String),
      targetEntityType: 'RiskProfile',
      action: 'RISK_PROFILE_CONFIGURED',
    }));
  });

  it('should update an existing risk profile', async () => {
    prismaService.workspaceMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      workspace: { organizationId: 'org-1' }
    });

    const existingProfile = new RiskProfile('id-1', 'org-1', 'ws-1', 1, 2, 3, 4, 5, 'ACTIVE');
    riskProfileRepository.findByWorkspaceId.mockResolvedValue(existingProfile);

    const command = new ConfigureRiskProfileCommand('ws-1', 5, 10, 100, 2, 20, 'actor-1');
    await handler.execute(command);

    expect(riskProfileRepository.save).toHaveBeenCalled();
    const savedProfile = riskProfileRepository.save.mock.calls[0][0];
    expect(savedProfile.getMaxDailyLoss()).toBe(5);
    expect(savedProfile.getMarginThreshold()).toBe(20);
  });
});
