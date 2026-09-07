import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CalculateCorrelationCommand } from '../commands/calculate-correlation.command';
import { CorrelationEngineService } from '../../domain/services/correlation-engine.service';

@CommandHandler(CalculateCorrelationCommand)
export class CalculateCorrelationHandler implements ICommandHandler<CalculateCorrelationCommand> {
  private readonly logger = new Logger(CalculateCorrelationHandler.name);

  constructor(
    private readonly correlationEngine: CorrelationEngineService,
  ) {}

  async execute(command: CalculateCorrelationCommand): Promise<void> {
    this.logger.debug(`Calculating pairwise correlation matrix for timeframe ${command.timeframe} (limit: ${command.limit})`);
    await this.correlationEngine.generateCorrelationMatrix(command.timeframe, command.limit);
  }
}
