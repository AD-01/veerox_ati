import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { UpdateWorkspaceMemberRoleCommand } from '../commands/update-workspace-member-role.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(UpdateWorkspaceMemberRoleCommand)
export class UpdateWorkspaceMemberRoleHandler implements ICommandHandler<UpdateWorkspaceMemberRoleCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateWorkspaceMemberRoleCommand): Promise<void> {
    const workspace = await this.workspaceRepository.findById(command.workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.organizationId !== command.organizationId) {
      throw new ForbiddenException('Workspace does not belong to the specified organization');
    }

    if (command.actorUserId === command.targetUserId) {
      throw new ConflictException('Users cannot modify their own roles');
    }

    const previousState = JSON.stringify({
      organizationId: command.organizationId,
      workspaceId: command.workspaceId,
      data: workspace
    });

    workspace.updateMemberRole(command.targetUserId, command.role, command.actorUserId);

    await this.workspaceRepository.save(workspace);

    await this.auditRepository.log({
      actorId: command.actorUserId,
      targetUserId: command.targetUserId,
      action: 'UpdateWorkspaceMemberRole',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        data: workspace
      }),
      reason: 'User role updated in workspace',
    });

    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();
  }
}
