import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { AddWorkspaceMemberCommand } from '../commands/add-workspace-member.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@CommandHandler(AddWorkspaceMemberCommand)
export class AddWorkspaceMemberHandler implements ICommandHandler<AddWorkspaceMemberCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AddWorkspaceMemberCommand): Promise<void> {
    const workspace = await this.workspaceRepository.findById(command.workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.organizationId !== command.organizationId) {
      throw new ForbiddenException('Workspace does not belong to the specified organization');
    }

    // Verify target user is an active organization member
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: command.organizationId,
          userId: command.targetUserId
        }
      }
    });

    if (!orgMember || orgMember.status !== 'ACTIVE') {
      throw new ForbiddenException('Target user is not an active member of this organization');
    }

    // Validate the role (must be a valid workspace role like Workspace Admin, Trader, Viewer, etc)
    const validRole = await this.prisma.role.findFirst({
      where: { name: command.role }
    });

    if (!validRole) {
      throw new NotFoundException(`Role ${command.role} is not valid`);
    }

    const previousState = JSON.stringify({
      organizationId: command.organizationId,
      workspaceId: command.workspaceId,
      data: workspace
    });

    workspace.addMember(command.targetUserId, command.role, command.actorUserId);

    await this.workspaceRepository.save(workspace);

    await this.auditRepository.log({
      actorId: command.actorUserId,
      targetUserId: command.targetUserId,
      action: 'AddWorkspaceMember',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        data: workspace
      }),
      reason: 'User added to workspace',
    });

    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();
  }
}
