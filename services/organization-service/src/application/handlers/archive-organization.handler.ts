import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { ArchiveOrganizationCommand } from '../commands/archive-organization.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { AuthorizationService } from '../../domain/services/authorization.service';
import { ForbiddenException } from '@nestjs/common';

@CommandHandler(ArchiveOrganizationCommand)
export class ArchiveOrganizationHandler implements ICommandHandler<ArchiveOrganizationCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ArchiveOrganizationCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canManageOrganization(actorRoles, command.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    const previousState = JSON.stringify(organization);

    // This will throw if it's already archived
    organization.archive();

    // Revoke relevant organization sessions/access according to S-05/S-06 integration
    // Since Session lacks an organizationId, the safest architectural mechanism is to actively delete 
    // all UserRoles scoped to this organization, thereby revoking all organizational privileges instantly.
    // We also mark memberships as ARCHIVED.
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({
        where: { organizationId: command.organizationId },
      }),
      this.prisma.organizationMember.updateMany({
        where: { organizationId: command.organizationId },
        data: { status: 'ARCHIVED' }
      })
    ]);

    await this.organizationRepository.save(organization);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'ArchiveOrganization',
      previousState,
      newState: JSON.stringify(organization),
      reason: command.reason || 'Archived by user',
    });

    for (const event of organization.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    organization.commit();
  }
}
