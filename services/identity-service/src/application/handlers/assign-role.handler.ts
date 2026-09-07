import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AssignRoleCommand } from '../commands/assign-role.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { AuthorizationService } from '../../domain/services/authorization.service';
import { UserRoleChangedEvent } from '@veerox/events/src/identity.events';

@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AssignRoleCommand): Promise<void> {
    const { userId, roleId, organizationId, workspaceId, actorId } = command;

    if (userId === actorId) {
      throw new ForbiddenException('Cannot assign a role to yourself');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Verify actor roles and scopes
    const actorUserRoles = await this.prisma.userRole.findMany({
      where: { userId: actorId },
      include: { role: true },
    });

    const actorRoleNames = actorUserRoles.map(ur => ur.role.name);

    if (!AuthorizationService.validateRoleHierarchy(actorRoleNames, role.name)) {
      throw new ForbiddenException('Cannot assign a role with equal or greater authority');
    }

    if (!AuthorizationService.validateScope(actorUserRoles, organizationId || null, workspaceId || null)) {
      throw new ForbiddenException('Cannot assign a role outside of your authority scope');
    }

    // Check if user already has this role in this scope
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        }
      }
    });

    // The current schema uses @@id([userId, roleId]) so they can't have the same role in different orgs
    // If they already have the role, we should just error or return
    if (existing) {
      throw new BadRequestException('User already has this role');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.create({
        data: {
          userId,
          roleId,
          organizationId: organizationId || null,
          workspaceId: workspaceId || null,
        },
      });
      
      await tx.auditLog.create({
        data: {
          actorId,
          targetUserId: userId,
          action: 'AssignRole',
          newState: JSON.stringify({ role: role.name, organizationId, workspaceId }),
        },
      });
    });

    this.eventBus.publish(new UserRoleChangedEvent(userId, '', role.name, actorId));
  }
}
