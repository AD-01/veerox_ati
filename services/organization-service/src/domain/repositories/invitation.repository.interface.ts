export interface InvitationProps {
  id: string;
  organizationId: string;
  email: string;
  invitedBy: string;
  invitationToken: string;
  expiresAt: Date;
  acceptedAt?: Date | null;
}

export interface IInvitationRepository {
  save(invitation: InvitationProps): Promise<void>;
  findByToken(token: string): Promise<InvitationProps | null>;
  findById(id: string): Promise<InvitationProps | null>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

