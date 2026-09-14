import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UpdateProviderConfigCommand } from '../commands/update-provider-config.command';
import { IMarketProviderRepository, MARKET_PROVIDER_REPOSITORY } from '../ports/market-provider.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@CommandHandler(UpdateProviderConfigCommand)
export class UpdateProviderConfigHandler implements ICommandHandler<UpdateProviderConfigCommand> {
  constructor(
    @Inject(MARKET_PROVIDER_REPOSITORY)
    private readonly repository: IMarketProviderRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateProviderConfigCommand): Promise<void> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: command.actorId },
      include: { role: true }
    });
    const isPlatformAdmin = userRoles.some(ur => ur.role.name === 'Platform Administrator');
    if (!isPlatformAdmin) {
      throw new UnauthorizedException('Only Platform Administrators can update global market providers');
    }

    const provider = await this.repository.findById(command.id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${command.id} not found`);
    }

    const previousState = JSON.stringify(provider);
    provider.updateConfig(command.config);

    await this.repository.save(provider);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'UpdateMarketProviderConfig',
      targetEntityId: provider.id,
      previousState: previousState,
      newState: JSON.stringify(provider),
      reason: 'Platform Admin updated market provider config',
    });
  }
}
