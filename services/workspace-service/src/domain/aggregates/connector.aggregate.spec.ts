import { Connector } from './connector.aggregate';
import { ConnectorCreatedEvent, ConnectorUpdatedEvent, ConnectorArchivedEvent } from '@veerox/events';

describe('Connector Aggregate', () => {
  const connectorId = 'connector-1';
  const organizationId = 'org-1';
  const workspaceId = 'workspace-1';
  const name = 'My Broker';
  const provider = 'MT5';

  describe('create', () => {
    it('should create a connector and emit ConnectorCreatedEvent', () => {
      const connector = Connector.create(connectorId, organizationId, workspaceId, name, provider);

      expect(connector.id).toBe(connectorId);
      expect(connector.status).toBe('ACTIVE');
      
      const uncommittedEvents = connector.getUncommittedEvents();
      expect(uncommittedEvents).toHaveLength(1);
      expect(uncommittedEvents[0]).toBeInstanceOf(ConnectorCreatedEvent);
      
      const event = uncommittedEvents[0] as ConnectorCreatedEvent;
      expect(event.connectorId).toBe(connectorId);
      expect(event.organizationId).toBe(organizationId);
      expect(event.workspaceId).toBe(workspaceId);
      expect(event.name).toBe(name);
      expect(event.provider).toBe(provider);
    });
  });

  describe('update', () => {
    it('should update name and emit ConnectorUpdatedEvent', () => {
      const connector = Connector.create(connectorId, organizationId, workspaceId, name, provider);
      connector.commit(); // Clear initial event

      const newName = 'New Broker Name';
      connector.update(newName);

      const uncommittedEvents = connector.getUncommittedEvents();
      expect(uncommittedEvents).toHaveLength(1);
      expect(uncommittedEvents[0]).toBeInstanceOf(ConnectorUpdatedEvent);
      
      const event = uncommittedEvents[0] as ConnectorUpdatedEvent;
      expect(event.connectorId).toBe(connectorId);
      expect(event.updates.name).toBe(newName);
    });
  });

  describe('archive', () => {
    it('should change status to ARCHIVED and emit ConnectorArchivedEvent', () => {
      const connector = Connector.create(connectorId, organizationId, workspaceId, name, provider);
      connector.commit();

      connector.archive();

      expect(connector.status).toBe('ARCHIVED');
      
      const uncommittedEvents = connector.getUncommittedEvents();
      expect(uncommittedEvents).toHaveLength(1);
      expect(uncommittedEvents[0]).toBeInstanceOf(ConnectorArchivedEvent);
      
      const event = uncommittedEvents[0] as ConnectorArchivedEvent;
      expect(event.connectorId).toBe(connectorId);
    });
  });
});
