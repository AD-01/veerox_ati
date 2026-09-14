import { Inject, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { AcceptInvitationCommand } from '../commands/accept-invitation.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IInvitationRepository, INVITATION_REPOSITORY } from '../../domain/repositories/invitation.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { MemberJoinedEvent } from '@veerox/events';
import { createHash } from 'crypto';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';
import { PrismaService } from '@veerox/database';

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitationCommand> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepository: IInvitationRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<void> {
    const hashedToken = createHash('sha256').update(command.token).digest('hex');
    
    const invitation = await this.invitationRepository.findByToken(hashedToken);
    if (!invitation) {
      throw new NotFoundException('Invalid or expired invitation token');
    }

    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation has already been accepted');
    }

    if (new Date() > invitation.expiresAt) {
      throw new ForbiddenException('Invitation has expired');
    }

    const organization = await this.organizationRepository.findById(invitation.organizationId);
    if (!organization || organization.status === OrganizationStatus.ARCHIVED) {
      throw new ForbiddenException('Organization is no longer active');
    }

    // Verify actor email matches the invitation email (optional but good practice)
    const user = await this.prisma.user.findUnique({
      where: { id: command.actorId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Wait, the prompt says "If an invitation is accepted by an email that does not correspond to an existing user and the authoritative architecture does not define automatic registration, do not invent automatic account creation. Report the dependency/requirement instead."
    // We already require actorId, meaning the user is authenticated. We just need to check if they match.
    if (user.email !== invitation.email) {
      throw new ForbiddenException('This invitation is for a different email address');
    }

    // Check if already a member
    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: command.actorId,
        }
      }
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Mark accepted
    invitation.acceptedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Assign default role (e.g., Viewer or Trader)
    // S-06 established roles. We will assign 'Trader' as a default if we don't have a specific role passed.
    const defaultRole = await this.prisma.role.findUnique({
      where: { name: 'Trader' }
    });

    if (defaultRole) {
      await this.prisma.userRole.create({
        data: {
          userId: command.actorId,
          organizationId: organization.id,
          roleId: defaultRole.id,
        }
      });
    }

    // Create membership
    await this.prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: command.actorId,
        status: 'ACTIVE',
      }
    });

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'AcceptInvitation',
      newState: JSON.stringify({ organizationId: organization.id }),
      reason: 'User accepted invitation',
    });

    this.eventBus.publish(
      new MemberJoinedEvent(organization.id, command.actorId, new Date())
    );
  }
}
