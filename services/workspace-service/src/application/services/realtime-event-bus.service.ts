import { Injectable } from '@nestjs/common';
import { Subject, filter } from 'rxjs';
import { EventEnvelope } from '@veerox/contracts';

@Injectable()
export class RealtimeEventBusService {
  private eventSubject = new Subject<EventEnvelope>();

  publish(event: EventEnvelope) {
    this.eventSubject.next(event);
  }

  getEventsForWorkspace(workspaceId: string, organizationId: string) {
    return this.eventSubject.asObservable().pipe(
      filter(event => event.workspaceId === workspaceId && event.organizationId === organizationId)
    );
  }
}
