import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { EvaluateStrategyCommand } from '../../commands/evaluate-strategy.command';

import { MarketIntelligenceSnapshot } from '../../../domain/aggregates/strategy-orchestration.aggregate';

// Mock event interface since we might not have it in @veerox/events yet
export class MarketIntelligenceUpdatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly snapshotId: string,
    public readonly intelligence: MarketIntelligenceSnapshot,
  ) {}
}

@EventsHandler(MarketIntelligenceUpdatedEvent)
export class MarketIntelligenceUpdatedEventHandler implements IEventHandler<MarketIntelligenceUpdatedEvent> {
  private readonly logger = new Logger(MarketIntelligenceUpdatedEventHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: MarketIntelligenceUpdatedEvent) {
    // For automated events, actorId is SYSTEM
    const systemActorId = '00000000-0000-0000-0000-000000000000';
    
    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt <= maxRetries) {
      try {
        await this.commandBus.execute(
          new EvaluateStrategyCommand(
            event.organizationId,
            event.workspaceId,
            event.snapshotId,
            event.intelligence,
            systemActorId,
          ),
        );
        return; // Success
      } catch (error) {
        attempt++;
        this.logger.warn(`Failed to process market intelligence update (attempt ${attempt}/${maxRetries + 1})`, error);
        
        if (attempt > maxRetries) {
          this.logger.error(`Critical Failure: Dropping market intelligence update for snapshot ${event.snapshotId} after ${maxRetries} retries`, error);
          return;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }
}
