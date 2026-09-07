import { Injectable } from '@nestjs/common';
import { ISymbolRepository } from '../../application/ports/symbol.repository.interface';
import { SymbolAggregate } from '../../domain/aggregates/symbol.aggregate';
import { PrismaService } from '@veerox/database';

@Injectable()
export class SymbolRepository implements ISymbolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(symbol: SymbolAggregate): Promise<void> {
    await this.prisma.symbol.upsert({
      where: { id: symbol.id },
      create: {
        id: symbol.id,
        providerId: symbol.providerId,
        brokerSymbol: symbol.brokerSymbol,
        standardSymbol: symbol.standardSymbol,
        assetType: symbol.assetType,
        contractSize: symbol.contractSize,
        tickSize: symbol.tickSize,
        precision: symbol.precision,
        status: symbol.status,
        createdAt: symbol.createdAt,
        updatedAt: symbol.updatedAt,
      },
      update: {
        providerId: symbol.providerId,
        brokerSymbol: symbol.brokerSymbol,
        standardSymbol: symbol.standardSymbol,
        assetType: symbol.assetType,
        contractSize: symbol.contractSize,
        tickSize: symbol.tickSize,
        precision: symbol.precision,
        status: symbol.status,
        updatedAt: symbol.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<SymbolAggregate | null> {
    const data = await this.prisma.symbol.findUnique({
      where: { id },
    });
    if (!data) return null;

    return SymbolAggregate.reconstitute({
      id: data.id,
      providerId: data.providerId,
      brokerSymbol: data.brokerSymbol,
      standardSymbol: data.standardSymbol,
      assetType: data.assetType,
      contractSize: Number(data.contractSize),
      tickSize: Number(data.tickSize),
      precision: data.precision,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByBrokerSymbol(providerId: string, brokerSymbol: string): Promise<SymbolAggregate | null> {
    const data = await this.prisma.symbol.findUnique({
      where: {
        providerId_brokerSymbol: {
          providerId,
          brokerSymbol,
        },
      },
    });
    if (!data) return null;

    return SymbolAggregate.reconstitute({
      id: data.id,
      providerId: data.providerId,
      brokerSymbol: data.brokerSymbol,
      standardSymbol: data.standardSymbol,
      assetType: data.assetType,
      contractSize: Number(data.contractSize),
      tickSize: Number(data.tickSize),
      precision: data.precision,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByStandardSymbol(standardSymbol: string): Promise<SymbolAggregate[]> {
    const data = await this.prisma.symbol.findMany({
      where: { standardSymbol },
    });
    return data.map(d => SymbolAggregate.reconstitute({
      id: d.id,
      providerId: d.providerId,
      brokerSymbol: d.brokerSymbol,
      standardSymbol: d.standardSymbol,
      assetType: d.assetType,
      contractSize: Number(d.contractSize),
      tickSize: Number(d.tickSize),
      precision: d.precision,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }
}
