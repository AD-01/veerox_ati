import { Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InviteMemberCommand } from '../commands/invite-member.command';
import { IOrganizationRepository, ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { IInvitationRepository } from '../../domain/repositories/invitation.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { MemberInvitedEvent } from '@veerox/events';
import { randomBytes, createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';
import { PrismaService } from '@veerox/database';
import { AuthorizationService } from '../../domain/services/authorization.service';
import { ForbiddenException } from '@nestjs/common';

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler implements ICommandHandler<InviteMemberCommand> {
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

  async execute(command: InviteMemberCommand): Promise<string> {
    const organization = await this.organizationRepository.findById(command.organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.status === OrganizationStatus.ARCHIVED) {
      throw new ConflictException('Cannot invite members to an archived organization');
    }

    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canManageOrganization(actorRoles, command.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    // Check if the user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: command.email }
    });

    if (existingUser) {
      const isMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: command.organizationId,
            userId: existingUser.id,
          }
        }
      });

      if (isMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    // Generate secure token
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = {
      id: randomUUID(),
      organizationId: command.organizationId,
      email: command.email,
      invitedBy: command.actorId,
      invitationToken: hashedToken,
      expiresAt,
    };

    await this.invitationRepository.save(invitation);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'InviteMember',
      newState: JSON.stringify({ email: command.email, invitationId: invitation.id }),
      reason: 'Invited new member',
    });

    // We do NOT expose the raw token in the event payload
    this.eventBus.publish(
      new MemberInvitedEvent(command.organizationId, command.email, command.actorId)
    );

    // In a real application, we would email the rawToken to the user here or via a listener to MemberInvitedEvent
    return rawToken;
  }
}
