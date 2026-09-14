import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { CurrentUser } from '@veerox/shared';
import { ConfigureRiskProfileDto } from '../dto/configure-risk-profile.dto';
import { ConfigureRiskProfileCommand } from '../../application/commands/risk-profile.commands';
import { PrismaService } from '@veerox/database';

@Controller('workspaces/:workspaceId/risk-profile')
@UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
export class RiskProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getRiskProfile(@Param('workspaceId') workspaceId: string): Promise<unknown> {
    const profile = await this.prisma.riskProfile.findUnique({
      where: { workspaceId },
    });

    if (!profile) {
      throw new NotFoundException(`Risk profile not configured for workspace: ${workspaceId}`);
    }

    return profile;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async configureRiskProfile(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ConfigureRiskProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.commandBus.execute(
      new ConfigureRiskProfileCommand(
        workspaceId,
        dto.maxDailyLoss,
        dto.maxDrawdown,
        dto.maxPositionSize,
        dto.maxOpenPositions,
        dto.marginThreshold,
        user.id,
      ),
    );

    return { message: 'Risk profile configured successfully' };
  }
}
