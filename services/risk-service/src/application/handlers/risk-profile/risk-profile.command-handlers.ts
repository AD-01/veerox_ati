import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigureRiskProfileCommand } from '../../commands/risk-profile.commands';
import { RiskProfile } from '../../../domain/aggregates/risk-profile.aggregate';
import {
  IRiskProfileRepository,
  RISK_PROFILE_REPOSITORY,
} from '../../ports/risk-profile.repository.interface';
import {
  IAuditRepository,
  AUDIT_REPOSITORY,
} from '../../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@CommandHandler(ConfigureRiskProfileCommand)
export class ConfigureRiskProfileHandler implements ICommandHandler<ConfigureRiskProfileCommand> {
  private readonly logger = new Logger(ConfigureRiskProfileHandler.name);

  constructor(
    @Inject(RISK_PROFILE_REPOSITORY)
    private readonly riskProfileRepository: IRiskProfileRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: ConfigureRiskProfileCommand): Promise<void> {
    this.logger.log(`Configuring risk profile for workspace: ${command.workspaceId}`);

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: command.workspaceId,
          userId: command.actorId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new Error(`Unauthorized: Actor is not an active member of workspace ${command.workspaceId}`);
    }

    const organizationId = membership.workspace.organizationId;

    let profile = await this.riskProfileRepository.findByWorkspaceId(command.workspaceId);

    if (!profile) {
      const id = crypto.randomUUID();
      profile = this.publisher.mergeObjectContext(
        new RiskProfile(
          id,
          organizationId,
          command.workspaceId,
          0,
          0,
          0,
          0,
          0,
          'ACTIVE',
        ),
      );
    }

    const previousState = {
      maxDailyLoss: profile.getMaxDailyLoss(),
      maxDrawdown: profile.getMaxDrawdown(),
      maxPositionSize: profile.getMaxPositionSize(),
      maxOpenPositions: profile.getMaxOpenPositions(),
      marginThreshold: profile.getMarginThreshold(),
    };

    profile.configureLimits(
      command.maxDailyLoss,
      command.maxDrawdown,
      command.maxPositionSize,
      command.maxOpenPositions,
      command.marginThreshold,
      command.actorId,
    );

    await this.riskProfileRepository.save(profile);

    const newState = {
      maxDailyLoss: command.maxDailyLoss,
      maxDrawdown: command.maxDrawdown,
      maxPositionSize: command.maxPositionSize,
      maxOpenPositions: command.maxOpenPositions,
      marginThreshold: command.marginThreshold,
    };

    await this.auditRepository.log({
      actorId: command.actorId,
      organizationId: organizationId,
      workspaceId: command.workspaceId,
      targetEntityId: profile.id,
      targetEntityType: 'RiskProfile',
      action: 'RISK_PROFILE_CONFIGURED',
      previousState: JSON.stringify(previousState),
      newState: JSON.stringify(newState),
      reason: 'User configured workspace risk profile',
    });

    this.logger.log(`Risk profile successfully configured for workspace: ${command.workspaceId}`);
  }
}

export const RiskProfileCommandHandlers = [ConfigureRiskProfileHandler];
