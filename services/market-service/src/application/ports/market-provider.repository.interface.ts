import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';

export interface IMarketProviderRepository {
  save(provider: MarketProviderAggregate): Promise<void>;
  findById(id: string): Promise<MarketProviderAggregate | null>;
  findByName(name: string): Promise<MarketProviderAggregate | null>;
  findAll(): Promise<MarketProviderAggregate[]>;
}

export const MARKET_PROVIDER_REPOSITORY = Symbol('MARKET_PROVIDER_REPOSITORY');
