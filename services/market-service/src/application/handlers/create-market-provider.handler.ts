import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { CreateMarketProviderCommand } from '../commands/create-market-provider.command';
import { IMarketProviderRepository, MARKET_PROVIDER_REPOSITORY } from '../ports/market-provider.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';
import { EventPublisher } from '@veerox/shared';
import { PrismaService } from '@veerox/database';

@CommandHandler(CreateMarketProviderCommand)
export class CreateMarketProviderHandler implements ICommandHandler<CreateMarketProviderCommand> {
  constructor(
    @Inject(MARKET_PROVIDER_REPOSITORY)
    private readonly repository: IMarketProviderRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    @Inject('EVENT_PUBLISHER')
    private readonly eventPublisher: EventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateMarketProviderCommand): Promise<string> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });
    const isPlatformAdmin = userRoles.some(ur => ur.role.name === 'Platform Administrator');
    if (!isPlatformAdmin) {
      throw new UnauthorizedException('Only Platform Administrators can create global market providers');
    }

    const existing = await this.repository.findByName(command.name);
    if (existing) {
      throw new Error(`Provider with name ${command.name} already exists`);
    }

    const provider = MarketProviderAggregate.create({
      name: command.name,
      type: command.type,
      config: command.config,
    });

    await this.repository.save(provider);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'CreateMarketProvider',
      newState: JSON.stringify(provider),
      reason: 'Platform Admin created new market provider',
    });

    return provider.id;
  }
}
