import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { DecisionGeneratedEvent } from '@veerox/events';
import { EvaluatePolicyCommand } from '../commands/evaluate-policy.command';

@EventsHandler(DecisionGeneratedEvent)
export class DecisionGeneratedEventHandler implements IEventHandler<DecisionGeneratedEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: DecisionGeneratedEvent) {
    // When a decision is generated, we evaluate it against policies
    const command = new EvaluatePolicyCommand(
      event.decisionId,
      event.correlationId,
      event.workspaceId,
      event.organizationId
    );

    // Dispatch the command to evaluate policies
    await this.commandBus.execute(command);
  }
}
