import { Inject, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { UpdateOrganizationCommand } from '../commands/update-organization.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { AuthorizationService } from '../../domain/services/authorization.service';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

@CommandHandler(UpdateOrganizationCommand)
export class UpdateOrganizationHandler implements ICommandHandler<UpdateOrganizationCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateOrganizationCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.status === OrganizationStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot modify an archived organization');
    }

    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });

    if (!AuthorizationService.canManageOrganization(actorRoles, command.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    if (command.name && command.name !== organization.name) {
      const existingName = await this.organizationRepository.findByName(command.name);
      if (existingName) {
        throw new ConflictException('Organization name already in use');
      }
    }

    const previousState = JSON.stringify(organization);

    organization.update(command.name, command.timezone, command.currency);

    await this.organizationRepository.save(organization);

    // Assuming actorId is not in the command right now. We could add actorId to track who did it.
    // Let's assume actorId is added later or through context, but since the command doesn't have it, we just use the system/owner.
    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'UpdateOrganization',
      previousState,
      newState: JSON.stringify(organization),
      reason: 'User updated organization settings',
    });

    for (const event of organization.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    
    organization.commit();
  }
}
