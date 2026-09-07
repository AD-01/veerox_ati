import { TradingAccount } from '../aggregates/trading-account.aggregate';

export const TRADING_ACCOUNT_REPOSITORY = 'TRADING_ACCOUNT_REPOSITORY';

export interface ITradingAccountRepository {
  save(account: TradingAccount): Promise<void>;
  findById(id: string, organizationId: string, workspaceId: string): Promise<TradingAccount | null>;
  findAllByWorkspace(organizationId: string, workspaceId: string): Promise<TradingAccount[]>;
  delete(id: string, organizationId: string, workspaceId: string): Promise<void>;
}
