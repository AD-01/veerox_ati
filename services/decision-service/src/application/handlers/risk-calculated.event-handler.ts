import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RiskCalculatedEvent } from '@veerox/events';
import { CorrelationService } from '../services/correlation.service';

@EventsHandler(RiskCalculatedEvent)
export class RiskCalculatedEventHandler implements IEventHandler<RiskCalculatedEvent> {
  private readonly logger = new Logger(RiskCalculatedEventHandler.name);

  constructor(private readonly correlationService: CorrelationService) {}

  async handle(event: RiskCalculatedEvent) {
    this.logger.log(`Received RiskCalculatedEvent for correlation ${event.correlationId}. Submitting for correlation.`);

    await this.correlationService.correlate({
      correlationId: event.correlationId,
      workspaceId: event.workspaceId,
      riskPayload: event,
    });
  }
}
