import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { UpdateWorkspaceSettingsCommand } from '../commands/update-workspace-settings.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(UpdateWorkspaceSettingsCommand)
export class UpdateWorkspaceSettingsHandler implements ICommandHandler<UpdateWorkspaceSettingsCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateWorkspaceSettingsCommand): Promise<void> {
    const workspace = await this.workspaceRepository.findById(command.workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.organizationId !== command.organizationId) {
      throw new ForbiddenException('Workspace does not belong to the specified organization');
    }

    const previousState = JSON.stringify({
      organizationId: command.organizationId,
      workspaceId: command.workspaceId,
      data: workspace.configuration?.toPrimitive() || {}
    });

    workspace.updateSettings(command.settings);

    await this.workspaceRepository.save(workspace);

    // Write Audit Log
    await this.auditRepository.log({
      actorId: command.updaterUserId,
      action: 'UpdateWorkspaceSettings',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        data: workspace.configuration?.toPrimitive()
      }),
      reason: 'User updated workspace settings',
    });

    // Dispatch Events
    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();
  }
}
