import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetConnectorQuery, ListConnectorsQuery, GetConnectorHealthHistoryQuery, GetConnectorCommandsQuery } from '../../queries/connector.queries';
import { PrismaConnectorRepository } from '../../../infrastructure/repositories/prisma-connector.repository';

@QueryHandler(GetConnectorQuery)
export class GetConnectorHandler implements IQueryHandler<GetConnectorQuery> {
  constructor(private readonly repository: PrismaConnectorRepository) {}

  async execute(query: GetConnectorQuery) {
    return this.repository.findById(query.connectorId, query.organizationId, query.workspaceId);
  }
}

@QueryHandler(ListConnectorsQuery)
export class ListConnectorsHandler implements IQueryHandler<ListConnectorsQuery> {
  constructor(private readonly repository: PrismaConnectorRepository) {}

  async execute(query: ListConnectorsQuery) {
    return this.repository.findAllByWorkspace(query.organizationId, query.workspaceId);
  }
}

@QueryHandler(GetConnectorHealthHistoryQuery)
export class GetConnectorHealthHistoryHandler implements IQueryHandler<GetConnectorHealthHistoryQuery> {
  constructor(private readonly repository: PrismaConnectorRepository) {}

  async execute(query: GetConnectorHealthHistoryQuery) {
    // Ownership is enforced by the repository method
    const history = await this.repository.getHealthHistory(
      query.connectorId,
      query.organizationId,
      query.workspaceId,
      query.from,
      query.to,
      query.limit,
    );

    return history;
  }
}

@QueryHandler(GetConnectorCommandsQuery)
export class GetConnectorCommandsHandler implements IQueryHandler<GetConnectorCommandsQuery> {
  constructor(private readonly repository: PrismaConnectorRepository) {}

  async execute(query: GetConnectorCommandsQuery) {
    return this.repository.getCommandHistory(
      query.connectorId,
      query.organizationId,
      query.workspaceId,
      query.limit,
    );
  }
}
