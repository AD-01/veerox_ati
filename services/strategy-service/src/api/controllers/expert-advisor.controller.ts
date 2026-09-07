import { Controller, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { IsString, IsUUID, IsOptional, IsUrl, IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { StrategyScopeGuard } from '../../infrastructure/auth/strategy-scope.guard';
import { RegisterExpertAdvisorCommand, ChangeExpertAdvisorStatusCommand } from '../../application/commands/expert-advisor.commands';

// Mock decorators removed

export class RegisterExpertAdvisorDto {
  @IsUUID()
  strategyId!: string;

  @IsString()
  version!: string;

  @IsOptional()
  @IsUrl()
  binaryUrl!: string | null;

  @IsOptional()
  @IsUrl()
  sourceUrl!: string | null;

  @IsOptional()
  @IsString()
  signature!: string | null;
}

export class ChangeExpertAdvisorStatusDto {
  @IsEnum(['TESTING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DEPRECATED'])
  status!: 'TESTING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DEPRECATED';
}

@Controller('organizations/:organizationId/expert-advisors')
@UseGuards(JwtAuthGuard, StrategyScopeGuard)
export class ExpertAdvisorController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('/')
  async registerExpertAdvisor(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Body() dto: RegisterExpertAdvisorDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorId = (req.user as any)?.userId || (req.user as any)?.id;
    const command = new RegisterExpertAdvisorCommand(
      organizationId,
      dto.strategyId,
      dto.version,
      dto.binaryUrl,
      dto.sourceUrl,
      dto.signature,
      actorId,
    );
    const id = await this.commandBus.execute(command);
    return { id };
  }

  @Patch('/:expertAdvisorId/status')
  async changeStatus(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Param('expertAdvisorId') expertAdvisorId: string,
    @Body() dto: ChangeExpertAdvisorStatusDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorId = (req.user as any)?.userId || (req.user as any)?.id;
    const command = new ChangeExpertAdvisorStatusCommand(
      expertAdvisorId,
      organizationId,
      dto.status,
      actorId,
    );
    await this.commandBus.execute(command);
    return { success: true };
  }
}
