import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PositionClosedEvent } from '@veerox/events';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';

@EventsHandler(PositionClosedEvent)
export class PositionClosedHandler implements IEventHandler<PositionClosedEvent> {
  private readonly logger = new Logger(PositionClosedHandler.name);

  constructor(private readonly repository: OpenPositionRepository) {}

  async handle(event: PositionClosedEvent) {
    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt <= maxRetries) {
      try {
        await this.repository.removePosition(event.positionId);
        return;
      } catch (error) {
        attempt++;
        this.logger.warn(`Failed to process position closed event (attempt ${attempt}/${maxRetries + 1})`, error);
        
        if (attempt > maxRetries) {
          this.logger.error(`Critical Failure: Dropping position closed event for position ${event.positionId} after ${maxRetries} retries`, error);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }
}
