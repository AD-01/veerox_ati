import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { UpdateOrganizationMemberRoleCommand } from '../commands/update-organization-member-role.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { RolePolicy } from '@veerox/shared';

@CommandHandler(UpdateOrganizationMemberRoleCommand)
export class UpdateOrganizationMemberRoleHandler implements ICommandHandler<UpdateOrganizationMemberRoleCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateOrganizationMemberRoleCommand): Promise<void> {
    const org = await this.organizationRepository.findById(command.organizationId);

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (command.actorUserId === command.targetUserId) {
      throw new ConflictException('Users cannot modify their own roles');
    }

    // Role Hierarchy Validation
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorUserId, organizationId: command.organizationId, workspaceId: null },
      include: { role: true }
    });

    const targetRoles = await this.prisma.userRole.findMany({
      where: { userId: command.targetUserId, organizationId: command.organizationId, workspaceId: null },
      include: { role: true }
    });

    const canMutate = RolePolicy.canMutateMember(actorRoles, targetRoles, command.actorUserId === command.targetUserId, command.role);
    if (!canMutate) {
      throw new ForbiddenException('Insufficient role weight to modify this user to the requested role');
    }

    const previousState = JSON.stringify({
      organizationId: command.organizationId,
      data: org
    });

    // Assume organization aggregate has an updateMemberRole method similar to workspace
    org.updateMemberRole(command.targetUserId, command.role, command.actorUserId);

    await this.prisma.$transaction(async (tx) => {
      // Find role UUID
      const newRoleEntity = await tx.role.findUnique({ where: { name: command.role } });
      if (!newRoleEntity) {
        throw new NotFoundException(`Role ${command.role} not found in system`);
      }

      await tx.userRole.deleteMany({
        where: {
          userId: command.targetUserId,
          organizationId: command.organizationId,
          workspaceId: null
        }
      });

      await tx.userRole.create({
        data: {
          userId: command.targetUserId,
          organizationId: command.organizationId,
          roleId: newRoleEntity.id,
        }
      });
    });

    await this.organizationRepository.save(org);

    await this.auditRepository.log({
      actorId: command.actorUserId,
      targetUserId: command.targetUserId,
      action: 'UpdateOrganizationMemberRole',
      previousState: previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        data: org
      }),
      reason: 'User role updated in organization',
    });

    for (const event of org.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    org.commit();
  }
}
