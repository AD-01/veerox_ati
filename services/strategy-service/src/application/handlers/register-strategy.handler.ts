import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RegisterStrategyCommand } from '../commands/register-strategy.command';
import { StrategyRepository } from '../../infrastructure/repositories/strategy.repository';
import { Strategy } from '../../domain/aggregates/strategy.aggregate';
import { randomUUID } from 'crypto';

@CommandHandler(RegisterStrategyCommand)
export class RegisterStrategyHandler implements ICommandHandler<RegisterStrategyCommand> {
  constructor(private readonly repository: StrategyRepository) {}

  async execute(command: RegisterStrategyCommand): Promise<string> {
    const strategy = new Strategy(
      randomUUID(),
      command.organizationId,
      command.name,
      command.version,
      command.description,
      command.author,
      command.riskProfile,
      'DRAFT',
      new Date(),
      new Date(),
    );

    strategy.register();
    await this.repository.save(strategy);

    return strategy.id;
  }
}
