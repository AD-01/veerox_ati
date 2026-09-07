import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PositionOpenedEvent } from '@veerox/events';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';

@EventsHandler(PositionOpenedEvent)
export class PositionOpenedHandler implements IEventHandler<PositionOpenedEvent> {
  private readonly logger = new Logger(PositionOpenedHandler.name);

  constructor(private readonly repository: OpenPositionRepository) {}

  async handle(event: PositionOpenedEvent) {
    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt <= maxRetries) {
      try {
        await this.repository.upsertPosition({
          id: event.positionId,
          workspaceId: event.workspaceId,
          symbolId: event.symbolId,
          strategyId: event.strategyId,
          status: 'OPEN',
        });
        return; // Success
      } catch (error) {
        attempt++;
        this.logger.warn(`Failed to process position opened event (attempt ${attempt}/${maxRetries + 1})`, error);
        
        if (attempt > maxRetries) {
          this.logger.error(`Critical Failure: Dropping position opened event for position ${event.positionId} after ${maxRetries} retries`, error);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }
}
