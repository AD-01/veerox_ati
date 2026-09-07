import { Inject, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateOrganizationCommand } from '../commands/create-organization.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { Organization } from '../../domain/aggregates/organization.aggregate';
import { randomUUID } from 'crypto';
import { PrismaService } from '@veerox/database/src/prisma.service';


@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler implements ICommandHandler<CreateOrganizationCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<string> {
    const existingName = await this.organizationRepository.findByName(command.name);
    if (existingName) {
      throw new ConflictException('Organization name already in use');
    }

    const existingSlug = await this.organizationRepository.findBySlug(command.slug);
    if (existingSlug) {
      throw new ConflictException('Organization slug already in use');
    }

    const orgId = randomUUID();
    const organization = Organization.create(
      orgId,
      command.name,
      command.slug,
      command.ownerUserId,
      command.timezone,
      command.currency,
    );

    // Write to database
    await this.organizationRepository.save(organization);

    // Also add the owner as an OrganizationMember with an Owner/Admin role
    // Wait, the prompt says "The organization owner remains represented by owner_user_id. Organization administrators are represented through the existing role/membership model."
    // Let's create the membership mapping. We assume there's a Role named "Organization Admin".
    // Find the Role ID for "Organization Admin".
    const ownerRole = await this.prisma.role.findUnique({
      where: { name: 'Organization Admin' }
    });

    if (ownerRole) {
      await this.prisma.userRole.create({
        data: {
          userId: command.ownerUserId,
          organizationId: orgId,
          roleId: ownerRole.id,
        }
      });
    }

    await this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: command.ownerUserId,
        status: 'ACTIVE',
      }
    });

    // Write Audit Log
    await this.auditRepository.log({
      actorId: command.ownerUserId,
      action: 'CreateOrganization',
      newState: JSON.stringify(organization),
      reason: 'User created new organization',
    });

    // Dispatch Events
    for (const event of organization.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    organization.commit();
    
    return orgId;
  }
}

