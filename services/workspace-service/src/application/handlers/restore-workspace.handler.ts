import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { RestoreWorkspaceCommand } from '../commands/restore-workspace.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(RestoreWorkspaceCommand)
export class RestoreWorkspaceHandler implements ICommandHandler<RestoreWorkspaceCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RestoreWorkspaceCommand): Promise<void> {
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
      data: workspace
    });

    workspace.restore();

    await this.workspaceRepository.save(workspace);

    await this.auditRepository.log({
      actorId: command.actorUserId,
      action: 'RestoreWorkspace',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        data: workspace
      }),
      reason: 'User restored workspace',
    });

    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();
  }
}
