import { Inject, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RemoveMemberCommand } from '../commands/remove-member.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { AuthorizationService } from '../../domain/services/authorization.service';


@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler implements ICommandHandler<RemoveMemberCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization || organization.status === OrganizationStatus.ARCHIVED) {
      throw new NotFoundException('Organization not found or is archived');
    }

    if (organization.ownerUserId === command.targetUserId) {
      throw new ConflictException('Cannot remove the organization owner');
    }

    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true },
    });

    const isSelfRemoval = command.actorId === command.targetUserId;
    if (!isSelfRemoval && !AuthorizationService.canManageOrganization(actorRoles, command.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: command.organizationId,
          userId: command.targetUserId,
        }
      }
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Delete membership and roles
    await this.prisma.$transaction([
      this.prisma.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: command.organizationId,
            userId: command.targetUserId,
          }
        }
      }),
      this.prisma.userRole.deleteMany({
        where: {
          organizationId: command.organizationId,
          userId: command.targetUserId,
        }
      })
    ]);

    await this.auditRepository.log({
      actorId: command.actorId,
      targetUserId: command.targetUserId,
      action: 'RemoveMember',
      previousState: JSON.stringify(membership),
      reason: 'Member removed from organization',
    });
  }
}
