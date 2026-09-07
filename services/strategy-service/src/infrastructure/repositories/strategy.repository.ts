import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { Strategy, StrategyStatus, RiskProfile } from '../../domain/aggregates/strategy.aggregate';
import { EventPublisher } from '@nestjs/cqrs';

@Injectable()
export class StrategyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async save(strategy: Strategy): Promise<void> {
    const data = {
      organizationId: strategy.organizationId,
      name: strategy.name,
      version: strategy.version,
      description: strategy.description,
      author: strategy.author,
      riskProfile: strategy.riskProfile,
      status: strategy.status,
    };

    await this.prisma.strategy.upsert({
      where: { id: strategy.id },
      create: {
        id: strategy.id,
        ...data,
      },
      update: data,
    });

    strategy.commit();
  }

  async findById(id: string): Promise<Strategy | null> {
    const record = await this.prisma.strategy.findUnique({ where: { id } });
    if (!record) return null;

    const aggregate = new Strategy(
      record.id,
      record.organizationId,
      record.name,
      record.version,
      record.description,
      record.author,
      record.riskProfile as RiskProfile,
      record.status as StrategyStatus,
      record.createdAt,
      record.updatedAt,
    );

    return this.publisher.mergeObjectContext(aggregate);
  }
  
  async findActiveByOrganization(organizationId: string): Promise<Strategy[]> {
    const records = await this.prisma.strategy.findMany({
      where: { organizationId, status: 'ACTIVE' },
    });

    return records.map(record => {
      const aggregate = new Strategy(
        record.id,
        record.organizationId,
        record.name,
        record.version,
        record.description,
        record.author,
        record.riskProfile as RiskProfile,
        record.status as StrategyStatus,
        record.createdAt,
        record.updatedAt,
      );
      return this.publisher.mergeObjectContext(aggregate);
    });
  }

  async findAllActive(): Promise<Strategy[]> {
    const records = await this.prisma.strategy.findMany({
      where: { status: 'ACTIVE' },
    });

    return records.map(record => {
      const aggregate = new Strategy(
        record.id,
        record.organizationId,
        record.name,
        record.version,
        record.description,
        record.author,
        record.riskProfile as RiskProfile,
        record.status as StrategyStatus,
        record.createdAt,
        record.updatedAt,
      );
      return this.publisher.mergeObjectContext(aggregate);
    });
  }
}
