import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { CreateSymbolCommand } from '../commands/create-symbol.command';
import { ISymbolRepository, SYMBOL_REPOSITORY } from '../ports/symbol.repository.interface';
import { IMarketProviderRepository, MARKET_PROVIDER_REPOSITORY } from '../ports/market-provider.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';
import { EventPublisher } from '@veerox/shared';
import { PrismaService } from '@veerox/database/src/prisma.service';

@CommandHandler(CreateSymbolCommand)
export class CreateSymbolHandler implements ICommandHandler<CreateSymbolCommand> {
  constructor(
    @Inject(SYMBOL_REPOSITORY)
    private readonly symbolRepository: ISymbolRepository,
    @Inject(MARKET_PROVIDER_REPOSITORY)
    private readonly providerRepository: IMarketProviderRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    @Inject('EVENT_PUBLISHER')
    private readonly eventPublisher: EventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateSymbolCommand): Promise<string> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });
    const isPlatformAdmin = userRoles.some(ur => ur.role.name === 'Platform Administrator');
    if (!isPlatformAdmin) {
      throw new UnauthorizedException('Only Platform Administrators can create global symbols');
    }

    const provider = await this.providerRepository.findById(command.providerId);
    if (!provider) {
      throw new NotFoundException(`Market provider with ID ${command.providerId} not found`);
    }

    const symbol = SymbolAggregate.create({
      providerId: command.providerId,
      brokerSymbol: command.brokerSymbol,
      standardSymbol: command.standardSymbol,
      assetType: command.assetType,
      contractSize: command.contractSize,
      tickSize: command.tickSize,
      precision: command.precision,
    });

    await this.symbolRepository.save(symbol);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'CreateSymbol',
      newState: JSON.stringify(symbol),
      reason: 'Platform Admin created new symbol',
    });

    return symbol.id;
  }
}
