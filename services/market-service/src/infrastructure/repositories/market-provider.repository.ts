import { Injectable } from '@nestjs/common';
import { IMarketProviderRepository } from '../../application/ports/market-provider.repository.interface';
import { MarketProviderAggregate } from '../../domain/aggregates/market-provider.aggregate';
import { PrismaService } from '@veerox/database';

@Injectable()
export class MarketProviderRepository implements IMarketProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(provider: MarketProviderAggregate): Promise<void> {
    await this.prisma.marketProvider.upsert({
      where: { id: provider.id },
      create: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        config: provider.config,
        status: provider.status,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
      update: {
        name: provider.name,
        type: provider.type,
        config: provider.config,
        status: provider.status,
        updatedAt: provider.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<MarketProviderAggregate | null> {
    const data = await this.prisma.marketProvider.findUnique({
      where: { id },
    });
    if (!data) return null;

    return MarketProviderAggregate.reconstitute({
      id: data.id,
      name: data.name,
      type: data.type,
      config: data.config,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findByName(name: string): Promise<MarketProviderAggregate | null> {
    const data = await this.prisma.marketProvider.findUnique({
      where: { name },
    });
    if (!data) return null;

    return MarketProviderAggregate.reconstitute({
      id: data.id,
      name: data.name,
      type: data.type,
      config: data.config,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findAll(): Promise<MarketProviderAggregate[]> {
    const data = await this.prisma.marketProvider.findMany();
    return data.map(d => MarketProviderAggregate.reconstitute({
      id: d.id,
      name: d.name,
      type: d.type,
      config: d.config,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }
}
