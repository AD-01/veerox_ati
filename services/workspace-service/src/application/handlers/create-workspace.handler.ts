import { Inject, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateWorkspaceCommand } from '../commands/create-workspace.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { Workspace } from '../../domain/aggregates/workspace.aggregate';
import { randomUUID } from 'crypto';
import { PrismaService } from '@veerox/database/src/prisma.service';

@CommandHandler(CreateWorkspaceCommand)
export class CreateWorkspaceHandler implements ICommandHandler<CreateWorkspaceCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateWorkspaceCommand): Promise<string> {
    const existingName = await this.workspaceRepository.findByNameAndOrganization(
      command.name,
      command.organizationId
    );

    if (existingName) {
      throw new ConflictException('Workspace name already in use within this organization');
    }

    const workspaceId = randomUUID();
    const workspace = Workspace.create(
      workspaceId,
      command.organizationId,
      command.name,
      {
        tradingPolicies: command.initialTradingPolicies || '{}',
        riskLimits: command.initialRiskLimits || '{}',
        notificationSettings: command.initialNotificationSettings || '{}',
        strategyPreferences: command.initialStrategyPreferences || '{}',
        automationMode: command.automationMode || 'MANUAL',
      }
    );

    await this.workspaceRepository.save(workspace);

    // Also add the creator as a WorkspaceMember with an Admin role
    const workspaceAdminRole = await this.prisma.role.findUnique({
      where: { name: 'Workspace Admin' } // Expected to be seeded
    });

    if (workspaceAdminRole) {
      // It's possible the user already has this role for the workspace if it's a re-creation but UUIDs ensure uniqueness
      await this.prisma.userRole.create({
        data: {
          userId: command.creatorUserId,
          organizationId: command.organizationId,
          workspaceId: workspaceId,
          roleId: workspaceAdminRole.id,
        }
      });
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspaceId,
        userId: command.creatorUserId,
        status: 'ACTIVE',
      }
    });

    // Write Audit Log
    await this.auditRepository.log({
      actorId: command.creatorUserId,
      action: 'CreateWorkspace',
      newState: JSON.stringify(workspace),
      reason: 'User created new workspace',
    });

    // Dispatch Events
    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();

    return workspaceId;
  }
}
