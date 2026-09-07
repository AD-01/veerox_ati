import { Controller, Post, Body, Get, Put, Delete, Param, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from '../../application/commands/register-user.command';
import { SuspendUserCommand } from '../../application/commands/suspend-user.command';
import { ActivateUserCommand } from '../../application/commands/activate-user.command';
import { LockUserCommand } from '../../application/commands/lock-user.command';
import { UnlockUserCommand } from '../../application/commands/unlock-user.command';
import { DeleteUserCommand } from '../../application/commands/delete-user.command';
import { AssignRoleCommand } from '../../application/commands/assign-role.command';
import { RevokeRoleCommand } from '../../application/commands/revoke-role.command';
import { RegisterUserDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../../infrastructure/auth/authorization.guard';
import { Permissions } from '../../infrastructure/auth/decorators';

@Controller('api/v1/users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: RegisterUserDto) {
    const command = new RegisterUserCommand(
      dto.email,
      dto.username,
      dto.firstName,
      dto.lastName,
      dto.password,
    );
    const result = await this.commandBus.execute(command);
    return { success: true, data: { id: result } };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listUsers() {
    // Stub
    return { success: true, data: [], pagination: { page: 1, pageSize: 20, totalPages: 0, totalItems: 0 } };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  async updateUser(@Param('id') _id: string, @Body() _dto: any) {
    // Stub
    return { success: true, data: { id: _id } };
  }

  @Post(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async suspendUser(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    await this.commandBus.execute(new SuspendUserCommand(id, reason || 'Admin suspension', req.user.userId));
    return { success: true };
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async activateUser(@Param('id') id: string, @Request() req: any) {
    await this.commandBus.execute(new ActivateUserCommand(id, req.user.userId));
    return { success: true };
  }

  @Post(':id/lock')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lockUser(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    await this.commandBus.execute(new LockUserCommand(id, reason || 'Security lockout', req.user.userId));
    return { success: true };
  }

  @Post(':id/unlock')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async unlockUser(@Param('id') id: string, @Request() req: any) {
    await this.commandBus.execute(new UnlockUserCommand(id, req.user.userId));
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    await this.commandBus.execute(new DeleteUserCommand(id, 'Admin deletion', req.user.userId));
  }

  @Post(':id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.OK)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async assignRole(
    @Param('id') id: string,
    @Body('roleId') roleId: string,
    @Body('organizationId') organizationId: string | null,
    @Body('workspaceId') workspaceId: string | null,
    @Request() req: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    await this.commandBus.execute(new AssignRoleCommand(id, roleId, organizationId || null, workspaceId || null, req.user.userId));
    return { success: true };
  }

  @Delete(':id/roles/:roleId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('admin.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async revokeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Request() req: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    await this.commandBus.execute(new RevokeRoleCommand(id, roleId, req.user.userId));
  }
}
