import { Controller, Post, Body, Put, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { CreateMarketProviderCommand } from '../../application/commands/create-market-provider.command';
import { UpdateProviderConfigCommand } from '../../application/commands/update-provider-config.command';
import { CreateMarketProviderDto } from '../dtos/create-market-provider.dto';
import { UpdateProviderConfigDto } from '../dtos/update-provider-config.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

interface AuthenticatedUser {
  userId: string;
}

@Controller('market-providers')
@UseGuards(JwtAuthGuard)
export class MarketProviderController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createProvider(
    @Body() dto: CreateMarketProviderDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    const id = await this.commandBus.execute(
      new CreateMarketProviderCommand(dto.name, dto.type, dto.config, user.userId)
    );
    return { id };
  }

  @Put(':id/config')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateProviderConfigDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    await this.commandBus.execute(
      new UpdateProviderConfigCommand(id, dto.config, user.userId)
    );
    return { success: true };
  }
}
