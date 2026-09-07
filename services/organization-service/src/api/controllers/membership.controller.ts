import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { InviteMemberCommand } from '../../application/commands/invite-member.command';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation.command';
import { RemoveMemberCommand } from '../../application/commands/remove-member.command';
import { GetMembersQuery, GetPendingInvitationsQuery } from '../../application/queries/organization.queries';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedUser {
  userId: string;
}

interface InviteMemberDto {
  email: string;
}

interface AcceptInvitationDto {
  token: string;
}
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':id/members')
  async getMembers(@Req() req: Request, @Param('id') id: string) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const query = new GetMembersQuery(id, actorId);
    return this.queryBus.execute(query);
  }

  @Post(':id/invitations')
  async inviteMember(@Req() req: Request, @Param('id') id: string, @Body() body: InviteMemberDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new InviteMemberCommand(id, body.email, actorId);
    const token = await this.commandBus.execute(command);
    return { message: 'Invitation sent', token }; // Included in response for testing
  }

  @Get(':id/invitations')
  async getPendingInvitations(@Req() req: Request, @Param('id') id: string) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const query = new GetPendingInvitationsQuery(id, actorId);
    return this.queryBus.execute(query);
  }

  // Acceptance doesn't depend on a specific org in the path (token is globally unique)
  // but let's put it here for simplicity or at /invitations/accept
  @Post('invitations/accept')
  async acceptInvitation(@Req() req: Request, @Body() body: AcceptInvitationDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new AcceptInvitationCommand(body.token, actorId);
    await this.commandBus.execute(command);
    return { message: 'Invitation accepted successfully' };
  }

  @Delete(':id/members/:userId')
  async removeMember(@Req() req: Request, @Param('id') id: string, @Param('userId') userId: string) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new RemoveMemberCommand(id, userId, actorId);
    await this.commandBus.execute(command);
    return { message: 'Member removed successfully' };
  }
}
