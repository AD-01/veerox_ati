import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { RemoveWorkspaceMemberCommand } from '../commands/remove-workspace-member.command';
import { IWorkspaceRepository, WORKSPACE_REPOSITORY } from '../../domain/repositories/workspace.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { RolePolicy } from '@veerox/shared';

@CommandHandler(RemoveWorkspaceMemberCommand)
export class RemoveWorkspaceMemberHandler implements ICommandHandler<RemoveWorkspaceMemberCommand> {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RemoveWorkspaceMemberCommand): Promise<void> {
    const workspace = await this.workspaceRepository.findById(command.workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.organizationId !== command.organizationId) {
      throw new ForbiddenException('Workspace does not belong to the specified organization');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: command.organizationId },
    });
    if (org?.ownerUserId === command.targetUserId) {
      throw new ForbiddenException('Cannot remove the primary Organization Owner from a workspace');
    }

    // Role Hierarchy Validation
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorUserId, workspaceId: command.workspaceId },
      include: { role: true }
    });

    const targetRoles = await this.prisma.userRole.findMany({
      where: { userId: command.targetUserId, workspaceId: command.workspaceId },
      include: { role: true }
    });

    const canMutate = RolePolicy.canMutateMember(actorRoles, targetRoles, command.actorUserId === command.targetUserId);
    if (!canMutate) {
      throw new ForbiddenException('Insufficient role weight to remove this user');
    }

    const previousState = JSON.stringify({
      organizationId: command.organizationId,
      workspaceId: command.workspaceId,
      data: workspace
    });

    workspace.removeMember(command.targetUserId, command.actorUserId);

    await this.workspaceRepository.save(workspace);

    await this.auditRepository.log({
      actorId: command.actorUserId,
      targetUserId: command.targetUserId,
      action: 'RemoveWorkspaceMember',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        data: workspace
      }),
      reason: 'User removed from workspace',
    });

    for (const event of workspace.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    workspace.commit();
  }
}
