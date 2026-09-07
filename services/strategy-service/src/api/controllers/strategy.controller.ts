import { Controller, Post, Body, Req, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { StrategyScopeGuard } from '../../infrastructure/auth/strategy-scope.guard';
import { RegisterStrategyDto } from '../dto/register-strategy.dto';
import { RegisterStrategyCommand } from '../../application/commands/register-strategy.command';

@Controller('organizations/:organizationId/strategies')
@UseGuards(JwtAuthGuard, StrategyScopeGuard)
export class StrategyController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async registerStrategy(
    @Param('organizationId') organizationId: string,
    @Body() dto: RegisterStrategyDto, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Req() req: any
  ) {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('User ID is required in token payload');
    }
    const actorId = req.user.userId;

    const command = new RegisterStrategyCommand(
      organizationId,
      dto.name,
      dto.version,
      dto.description || null,
      actorId, // Using authenticated actor ID as the author
      dto.riskProfile,
    );

    const id = await this.commandBus.execute(command);
    return { id, message: 'Strategy registered successfully in DRAFT state' };
  }
}
