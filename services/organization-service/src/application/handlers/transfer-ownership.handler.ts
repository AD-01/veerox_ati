import { Inject, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { TransferOrganizationOwnershipCommand } from '../commands/transfer-ownership.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';
import { PrismaService } from '@veerox/database/src/prisma.service';

@CommandHandler(TransferOrganizationOwnershipCommand)
export class TransferOrganizationOwnershipHandler implements ICommandHandler<TransferOrganizationOwnershipCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: TransferOrganizationOwnershipCommand): Promise<void> {
    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization || organization.status === OrganizationStatus.ARCHIVED) {
      throw new NotFoundException('Organization not found or is archived');
    }

    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });

    const isPlatformAdmin = actorRoles.some(ur => ur.role.name === 'Platform Administrator');

    if (organization.ownerUserId !== command.actorId && !isPlatformAdmin) {
      throw new ForbiddenException('Only the current owner or Platform Administrator can transfer ownership');
    }

    if (command.confirmationCode !== 'CONFIRM') { // Simple confirmation logic, in real scenario might check a 2FA code or explicit token
      throw new ForbiddenException('Invalid confirmation code');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: command.organizationId,
          userId: command.newOwnerUserId,
        }
      }
    });

    if (!membership) {
      throw new ConflictException('New owner must be an existing organization member');
    }

    const previousState = JSON.stringify(organization);

    // This updates the domain aggregate
    organization.transferOwnership(command.newOwnerUserId);

    // Perform atomic update
    await this.prisma.$transaction(async (tx) => {
      // 1. Update organization owner
      await tx.organization.update({
        where: { id: organization.id },
        data: { ownerUserId: command.newOwnerUserId }
      });

      // 2. Ensure new owner has Organization Admin role (or Owner role)
      const ownerRole = await tx.role.findUnique({ where: { name: 'Organization Admin' } });
      if (ownerRole) {
        // Find if they already have it
        const hasRole = await tx.userRole.findUnique({
          where: {
            userId_roleId: {
              userId: command.newOwnerUserId,
              roleId: ownerRole.id, // Note: The schema might limit one role per user across system, wait, the schema has @@id([userId, roleId]) but also organizationId. Let's just upsert it.
            }
          }
        });

        if (!hasRole) {
          await tx.userRole.create({
            data: {
              userId: command.newOwnerUserId,
              organizationId: organization.id,
              roleId: ownerRole.id,
            }
          });
        }
      }
    });

    await this.auditRepository.log({
      actorId: command.actorId,
      targetUserId: command.newOwnerUserId,
      action: 'TransferOwnership',
      previousState,
      newState: JSON.stringify(organization),
      reason: 'Ownership transferred to new user',
    });

    for (const event of organization.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    organization.commit();
  }
}
