import { Injectable } from '@nestjs/common';
import { IInvitationRepository, InvitationProps } from '../../domain/repositories/invitation.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';

@Injectable()
export class PrismaInvitationRepository implements IInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(invitation: InvitationProps): Promise<void> {
    const data = {
      organizationId: invitation.organizationId,
      email: invitation.email,
      invitedBy: invitation.invitedBy,
      invitationToken: invitation.invitationToken,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt || null,
    };

    await this.prisma.invitation.upsert({
      where: { id: invitation.id },
      update: data,
      create: {
        id: invitation.id,
        ...data,
      },
    });
  }

  async findByToken(token: string): Promise<InvitationProps | null> {
    const record = await this.prisma.invitation.findUnique({ where: { invitationToken: token } });
    if (!record) return null;
    return record as InvitationProps;
  }

  async findById(id: string): Promise<InvitationProps | null> {
    const record = await this.prisma.invitation.findUnique({ where: { id } });
    if (!record) return null;
    return record as InvitationProps;
  }
}
