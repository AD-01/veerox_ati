import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ProcessMarketDataCommand } from '../commands/process-market-data.command';
import { ISymbolRepository, SYMBOL_REPOSITORY } from '../ports/symbol.repository.interface';
import { EventPublisher } from '@veerox/shared';
import { MarketDataUpdatedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database/src/prisma.service';

@CommandHandler(ProcessMarketDataCommand)
export class ProcessMarketDataHandler implements ICommandHandler<ProcessMarketDataCommand> {
  constructor(
    @Inject(SYMBOL_REPOSITORY)
    private readonly symbolRepository: ISymbolRepository,
    @Inject('EVENT_PUBLISHER')
    private readonly eventPublisher: EventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: ProcessMarketDataCommand): Promise<void> {
    // Basic auth check for ingestion: In real-world, we'd have a 'Data Provider' role or similar.
    // For now, ensuring it is a Platform Administrator or system account to prevent arbitrary unauthenticated ingestion.
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });
    const isPlatformAdmin = userRoles.some(ur => ur.role.name === 'Platform Administrator');
    if (!isPlatformAdmin) {
      throw new UnauthorizedException('Only Platform Administrators can ingest market data manually');
    }

    const symbol = await this.symbolRepository.findByBrokerSymbol(
      command.providerId,
      command.brokerSymbol
    );

    if (!symbol) {
      throw new NotFoundException(`Symbol ${command.brokerSymbol} not found for provider ${command.providerId}`);
    }

    // Usually we would save ticks here via a TickRepository
    // ...

    // Publish the domain event
    const event = new MarketDataUpdatedEvent(
      symbol.id,
      new Date(command.timestamp),
      command.timeframe,
      command.open,
      command.high,
      command.low,
      command.close,
      command.volume,
      command.isClosed,
    );

    await this.eventPublisher.publish('market.data.updated', event);
  }
}
