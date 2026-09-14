import { Injectable } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@veerox/database';
import { IAIModelRepository } from '../../domain/repositories/ai-model.repository';
import { AIModel } from '../../domain/aggregates/ai-model.aggregate';
import { DomainTransaction } from '../../domain/repositories/transaction.interface';

type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

@Injectable()
export class PrismaAIModelRepository implements IAIModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: DomainTransaction): Promise<AIModel | null> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const record = await db.aIModel.findUnique({ where: { id } });
    if (!record) return null;

    return AIModel.reconstitute({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      provider: record.provider,
      modelName: record.modelName,
      modelVersion: record.modelVersion,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(model: AIModel, tx?: DomainTransaction): Promise<void> {
    const db = tx ? tx.getProvider<PrismaTransactionClient>() : this.prisma;
    const props = model.properties;
    
    await db.aIModel.upsert({
      where: { id: props.id },
      update: {
        status: props.status,
        updatedAt: props.updatedAt,
      },
      create: {
        id: props.id,
        organizationId: props.organizationId,
        workspaceId: props.workspaceId,
        provider: props.provider,
        modelName: props.modelName,
        modelVersion: props.modelVersion,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      }
    });
  }
}
