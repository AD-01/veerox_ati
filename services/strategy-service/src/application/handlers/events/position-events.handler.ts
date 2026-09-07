import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PositionOpenedEvent, PositionClosedEvent } from '@veerox/events';
import { OpenPositionRepository } from '../../../infrastructure/repositories/open-position.repository';

@EventsHandler(PositionOpenedEvent)
export class PositionOpenedEventHandler implements IEventHandler<PositionOpenedEvent> {
  constructor(private readonly repository: OpenPositionRepository) {}

  async handle(event: PositionOpenedEvent) {
    await this.repository.upsertPosition({
      id: event.positionId,
      workspaceId: event.workspaceId,
      symbolId: event.symbolId,
      strategyId: event.strategyId,
      status: 'OPEN',
    });
  }
}

@EventsHandler(PositionClosedEvent)
export class PositionClosedEventHandler implements IEventHandler<PositionClosedEvent> {
  constructor(private readonly repository: OpenPositionRepository) {}

  async handle(event: PositionClosedEvent) {
    await this.repository.removePosition(event.positionId);
  }
}
