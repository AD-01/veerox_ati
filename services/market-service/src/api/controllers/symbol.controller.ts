import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { CreateSymbolCommand } from '../../application/commands/create-symbol.command';
import { ProcessMarketDataCommand } from '../../application/commands/process-market-data.command';
import { CreateSymbolDto } from '../dtos/create-symbol.dto';
import { ProcessMarketDataDto } from '../dtos/process-market-data.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

interface AuthenticatedUser {
  userId: string;
}

@Controller('symbols')
@UseGuards(JwtAuthGuard)
export class SymbolController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createSymbol(
    @Body() dto: CreateSymbolDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    const id = await this.commandBus.execute(
      new CreateSymbolCommand(
        dto.providerId,
        dto.brokerSymbol,
        dto.standardSymbol,
        dto.assetType,
        dto.contractSize,
        dto.tickSize,
        dto.precision,
        user.userId
      )
    );
    return { id };
  }

  @Post(':providerId/:brokerSymbol/ticks')
  async processMarketData(
    @Param('providerId') providerId: string,
    @Param('brokerSymbol') brokerSymbol: string,
    @Body() dto: ProcessMarketDataDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    await this.commandBus.execute(
      new ProcessMarketDataCommand(
        providerId,
        brokerSymbol,
        dto.timestamp,
        dto.timeframe,
        dto.open,
        dto.high,
        dto.low,
        dto.close,
        dto.volume,
        dto.isClosed,
        user.userId
      )
    );
    return { success: true };
  }
}
