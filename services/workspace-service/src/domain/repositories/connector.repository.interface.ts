import { Connector } from '../aggregates/connector.aggregate';

export const CONNECTOR_REPOSITORY = 'CONNECTOR_REPOSITORY';

export interface IConnectorRepository {
  save(connector: Connector): Promise<void>;
  findById(id: string, organizationId: string, workspaceId: string): Promise<Connector | null>;
  findAllByWorkspace(organizationId: string, workspaceId: string): Promise<Connector[]>;
}
