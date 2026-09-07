import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { AssignStrategyCommand } from '../commands/strategy-orchestration.commands';
import { StrategyOrchestrationRepository } from '../../infrastructure/repositories/strategy-orchestration.repository';
import { StrategyOrchestration } from '../../domain/aggregates/strategy-orchestration.aggregate';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { Inject } from '@nestjs/common';

@CommandHandler(AssignStrategyCommand)
export class AssignStrategyHandler implements ICommandHandler<AssignStrategyCommand> {
  constructor(
    private readonly repository: StrategyOrchestrationRepository,
    private readonly publisher: EventPublisher,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(command: AssignStrategyCommand): Promise<void> {
    let orchestration = await this.repository.findByWorkspaceId(command.workspaceId);
    
    if (!orchestration) {
      orchestration = new StrategyOrchestration(command.workspaceId, null, null);
    }
    
    const aggregate = this.publisher.mergeObjectContext(orchestration);
    aggregate.assignExpertAdvisor(command.strategyId, command.expertAdvisorId);
    
    await this.repository.save(aggregate);
    
    await this.auditRepo.log({
      actorId: command.actorId,
      action: 'AssignStrategy',
      newState: JSON.stringify({ strategyId: command.strategyId, expertAdvisorId: command.expertAdvisorId }),
      correlationId: command.workspaceId, // Using correlationId for workspace context since targetUserId isn't exactly right
    });
  }
}
