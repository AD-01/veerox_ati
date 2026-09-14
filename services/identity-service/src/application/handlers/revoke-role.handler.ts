import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RevokeRoleCommand } from '../commands/revoke-role.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { PrismaService } from '@veerox/database';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { AuthorizationService } from '../../domain/services/authorization.service';
import { UserRoleChangedEvent } from '@veerox/events';

@CommandHandler(RevokeRoleCommand)
export class RevokeRoleHandler implements ICommandHandler<RevokeRoleCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RevokeRoleCommand): Promise<void> {
    const { userId, roleId, actorId } = command;

    if (userId === actorId) {
      throw new ForbiddenException('Cannot revoke your own role');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existingRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        }
      }
    });

    if (!existingRole) {
      throw new BadRequestException('User does not have this role');
    }

    // Verify actor roles and scopes
    const actorUserRoles = await this.prisma.userRole.findMany({
      where: { userId: actorId },
      include: { role: true },
    });

    const actorRoleNames = actorUserRoles.map(ur => ur.role.name);

    if (!AuthorizationService.validateRoleHierarchy(actorRoleNames, role.name)) {
      throw new ForbiddenException('Cannot revoke a role with equal or greater authority');
    }

    if (!AuthorizationService.validateScope(actorUserRoles, existingRole.organizationId, existingRole.workspaceId)) {
      throw new ForbiddenException('Cannot revoke a role outside of your authority scope');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId,
          }
        }
      });
      
      await tx.auditLog.create({
        data: {
          actorId,
          targetUserId: userId,
          action: 'RevokeRole',
          previousState: JSON.stringify({ role: role.name, organizationId: existingRole.organizationId, workspaceId: existingRole.workspaceId }),
        },
      });
    });

    this.eventBus.publish(new UserRoleChangedEvent(userId, role.name, '', actorId));
  }
}
