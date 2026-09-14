import { Connector } from '../aggregates/connector.aggregate';

export const CONNECTOR_REPOSITORY = 'CONNECTOR_REPOSITORY';

export interface IConnectorRepository {
  save(connector: Connector): Promise<void>;
  findById(id: string, organizationId: string, workspaceId: string): Promise<Connector | null>;
  findAllByWorkspace(organizationId: string, workspaceId: string): Promise<Connector[]>;
  getHealthHistory(
    connectorId: string,
    organizationId: string,
    workspaceId: string,
    from: Date,
    to: Date,
    limit: number
  ): Promise<any>;
  getCommandHistory(
    connectorId: string,
    organizationId: string,
    workspaceId: string,
    limit: number
  ): Promise<any>;
}
