import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import { RegisterExpertAdvisorCommand, ChangeExpertAdvisorStatusCommand } from '../commands/expert-advisor.commands';
import { ExpertAdvisorRepository } from '../../infrastructure/repositories/expert-advisor.repository';
import { ExpertAdvisor } from '../../domain/aggregates/expert-advisor.aggregate';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { Inject } from '@nestjs/common';

@CommandHandler(RegisterExpertAdvisorCommand)
export class RegisterExpertAdvisorHandler implements ICommandHandler<RegisterExpertAdvisorCommand> {
  constructor(
    private readonly repository: ExpertAdvisorRepository,
    private readonly publisher: EventPublisher,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(command: RegisterExpertAdvisorCommand): Promise<string> {
    const id = crypto.randomUUID();
    
    const ea = new ExpertAdvisor(
      id,
      command.organizationId,
      command.strategyId,
      command.version,
      command.binaryUrl,
      command.sourceUrl,
      command.signature,
      'DRAFT',
      new Date(),
      new Date(),
    );

    const aggregate = this.publisher.mergeObjectContext(ea);
    aggregate.register();
    
    await this.repository.save(aggregate);
    
    await this.auditRepo.log({
      actorId: command.actorId,
      targetEntityId: id,
      targetEntityType: 'ExpertAdvisor',
      organizationId: command.organizationId,
      action: 'RegisterExpertAdvisor',
      newState: JSON.stringify({ strategyId: command.strategyId, version: command.version }),
    });

    return id;
  }
}

@CommandHandler(ChangeExpertAdvisorStatusCommand)
export class ChangeExpertAdvisorStatusHandler implements ICommandHandler<ChangeExpertAdvisorStatusCommand> {
  constructor(
    private readonly repository: ExpertAdvisorRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(command: ChangeExpertAdvisorStatusCommand): Promise<void> {
    const ea = await this.repository.findById(command.expertAdvisorId);
    
    if (!ea) {
      throw new Error(`Expert Advisor with ID ${command.expertAdvisorId} not found`);
    }

    if (ea.organizationId !== command.organizationId) {
      throw new Error('Unauthorized: Expert Advisor belongs to a different organization');
    }

    ea.changeStatus(command.status);
    
    await this.repository.save(ea);
    
    await this.auditRepo.log({
      actorId: command.actorId,
      action: 'ChangeExpertAdvisorStatus',
      targetEntityId: command.expertAdvisorId,
      targetEntityType: 'ExpertAdvisor',
      newState: command.status,
    });
  }
}
