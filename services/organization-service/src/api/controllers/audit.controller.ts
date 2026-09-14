import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetAuditLogsQuery } from '../../application/queries/organization.queries';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedUser {
  userId: string;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/audit-logs')
  async getAuditLogs(
    @Req() req: Request,
    @Param('id') organizationId: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetEntityId') targetEntityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = (req.user as AuthenticatedUser).userId;
    const query = new GetAuditLogsQuery(organizationId, userId, {
      action,
      actorId,
      targetEntityId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return this.queryBus.execute(query);
  }
}
