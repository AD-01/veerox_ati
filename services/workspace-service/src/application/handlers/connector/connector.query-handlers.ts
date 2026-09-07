import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetConnectorQuery, ListConnectorsQuery } from '../../queries/connector.queries';
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
