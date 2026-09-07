import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { ExecutionOrderFailedEvent } from '@veerox/events';

@EventsHandler(ExecutionOrderFailedEvent)
export class ExecutionFailedEventHandler implements IEventHandler<ExecutionOrderFailedEvent> {
  private readonly logger = new Logger(ExecutionFailedEventHandler.name);

  async handle(event: ExecutionOrderFailedEvent) {
    this.logger.warn(`Execution order ${event.orderId} failed: ${event.failureReason}. No portfolio mutation required.`);
    // In advanced setups, this might release reserved margin if we supported margin locking.
    // For S-16, failed executions simply do not mutate the ledger.
  }
}
