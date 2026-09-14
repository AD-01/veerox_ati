import { Controller, Sse, Param, UseGuards, Req, MessageEvent } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { RealtimeEventBusService } from '../../application/services/realtime-event-bus.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { WorkspaceScopeGuard } from '@veerox/shared';
import { WorkspaceReadAccess } from '@veerox/shared';
import { EventEnvelope } from '@veerox/contracts';
import { Observable, map } from 'rxjs';

@Controller('org/:orgId/workspace/:id/realtime')
export class RealtimeController {
  constructor(private readonly eventBus: RealtimeEventBusService) {}

  @EventPattern('AccountStateChanged')
  handleAccountStateChanged(@Payload() data: EventEnvelope, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      this.eventBus.publish(data);
      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('PositionStateChanged')
  handlePositionStateChanged(@Payload() data: EventEnvelope, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      this.eventBus.publish(data);
      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('PositionClosed')
  handlePositionClosed(@Payload() data: EventEnvelope, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      this.eventBus.publish(data);
      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('OrderStateChanged')
  handleOrderStateChanged(@Payload() data: EventEnvelope, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      this.eventBus.publish(data);
      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, false);
    }
  }

  @Sse('stream')
  @UseGuards(JwtAuthGuard, WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  streamEvents(
    @Param('orgId') organizationId: string,
    @Param('id') workspaceId: string,
  ): Observable<MessageEvent> {
    return this.eventBus.getEventsForWorkspace(workspaceId, organizationId).pipe(
      map(event => ({
        data: event,
        id: event.eventId,
        type: event.eventType,
      }))
    );
  }
}
