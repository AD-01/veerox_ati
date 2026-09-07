import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetTradingAccountQuery, ListTradingAccountsQuery } from '../../queries/trading-account.queries';
import { PrismaTradingAccountRepository } from '../../../infrastructure/repositories/prisma-trading-account.repository';

@QueryHandler(GetTradingAccountQuery)
export class GetTradingAccountHandler implements IQueryHandler<GetTradingAccountQuery> {
  constructor(private readonly repository: PrismaTradingAccountRepository) {}

  async execute(query: GetTradingAccountQuery) {
    return this.repository.findById(query.accountId, query.organizationId, query.workspaceId);
  }
}

@QueryHandler(ListTradingAccountsQuery)
export class ListTradingAccountsHandler implements IQueryHandler<ListTradingAccountsQuery> {
  constructor(private readonly repository: PrismaTradingAccountRepository) {}

  async execute(query: ListTradingAccountsQuery) {
    return this.repository.findAllByWorkspace(query.organizationId, query.workspaceId);
  }
}
