import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { ExpertAdvisor, ExpertAdvisorStatus } from '../../domain/aggregates/expert-advisor.aggregate';
import { EventPublisher } from '@nestjs/cqrs';

@Injectable()
export class ExpertAdvisorRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async save(ea: ExpertAdvisor): Promise<void> {
    const data = {
      organizationId: ea.organizationId,
      strategyId: ea.strategyId,
      version: ea.version,
      binaryUrl: ea.binaryUrl,
      sourceUrl: ea.sourceUrl,
      signature: ea.signature,
      status: ea.status,
    };

    await this.prisma.expertAdvisor.upsert({
      where: { id: ea.id },
      create: {
        id: ea.id,
        ...data,
      },
      update: data,
    });

    ea.commit();
  }

  async findById(id: string): Promise<ExpertAdvisor | null> {
    const record = await this.prisma.expertAdvisor.findUnique({ where: { id } });
    if (!record) return null;

    const aggregate = new ExpertAdvisor(
      record.id,
      record.organizationId,
      record.strategyId,
      record.version,
      record.binaryUrl,
      record.sourceUrl,
      record.signature,
      record.status as ExpertAdvisorStatus,
      record.createdAt,
      record.updatedAt,
    );

    return this.publisher.mergeObjectContext(aggregate);
  }
}
