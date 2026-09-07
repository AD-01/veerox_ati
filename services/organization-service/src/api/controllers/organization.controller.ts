import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateOrganizationCommand } from '../../application/commands/create-organization.command';
import { UpdateOrganizationCommand } from '../../application/commands/update-organization.command';
import { ArchiveOrganizationCommand } from '../../application/commands/archive-organization.command';
import { TransferOrganizationOwnershipCommand } from '../../application/commands/transfer-ownership.command';
import { GetOrganizationQuery, ListOrganizationsQuery } from '../../application/queries/organization.queries';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedUser {
  userId: string;
}

interface CreateOrganizationDto {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
}

interface UpdateOrganizationDto {
  name?: string;
  timezone?: string;
  currency?: string;
}

interface ArchiveOrganizationDto {
  reason?: string;
}

interface TransferOwnershipDto {
  newOwnerUserId: string;
  confirmationCode: string;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createOrganization(@Req() req: Request, @Body() body: CreateOrganizationDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new CreateOrganizationCommand(
      body.name,
      body.slug,
      actorId, // owner
      body.timezone,
      body.currency
    );
    const orgId = await this.commandBus.execute(command);
    return { id: orgId, message: 'Organization created successfully' };
  }

  @Get()
  async listOrganizations(@Req() req: Request) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const query = new ListOrganizationsQuery(actorId);
    return this.queryBus.execute(query);
  }

  @Get(':id')
  async getOrganization(@Req() req: Request, @Param('id') id: string) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const query = new GetOrganizationQuery(id, actorId);
    return this.queryBus.execute(query);
  }

  @Put(':id')
  async updateOrganization(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateOrganizationDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new UpdateOrganizationCommand(
      id,
      actorId,
      body.name,
      body.timezone,
      body.currency
    );
    await this.commandBus.execute(command);
    return { message: 'Organization updated successfully' };
  }

  @Delete(':id')
  async archiveOrganization(@Req() req: Request, @Param('id') id: string, @Body() body: ArchiveOrganizationDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new ArchiveOrganizationCommand(id, actorId, body.reason);
    await this.commandBus.execute(command);
    return { message: 'Organization archived successfully' };
  }

  @Post(':id/transfer-ownership')
  async transferOwnership(@Req() req: Request, @Param('id') id: string, @Body() body: TransferOwnershipDto) {
    const actorId = (req.user as AuthenticatedUser).userId;
    const command = new TransferOrganizationOwnershipCommand(
      id,
      body.newOwnerUserId,
      actorId,
      body.confirmationCode
    );
    await this.commandBus.execute(command);
    return { message: 'Ownership transferred successfully' };
  }
}
