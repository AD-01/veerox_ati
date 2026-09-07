import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';

export interface ISymbolRepository {
  save(symbol: SymbolAggregate): Promise<void>;
  findById(id: string): Promise<SymbolAggregate | null>;
  findByBrokerSymbol(providerId: string, brokerSymbol: string): Promise<SymbolAggregate | null>;
  findByStandardSymbol(standardSymbol: string): Promise<SymbolAggregate[]>;
}

export const SYMBOL_REPOSITORY = Symbol('SYMBOL_REPOSITORY');
