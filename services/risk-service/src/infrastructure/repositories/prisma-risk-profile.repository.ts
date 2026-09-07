import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { EventPublisher } from '@nestjs/cqrs';
import { RiskProfile } from '../../domain/aggregates/risk-profile.aggregate';
import { IRiskProfileRepository } from '../../application/ports/risk-profile.repository.interface';

@Injectable()
export class PrismaRiskProfileRepository implements IRiskProfileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<RiskProfile | null> {
    const data = await this.prisma.riskProfile.findUnique({
      where: { workspaceId },
    });

    if (!data) return null;

    const aggregate = new RiskProfile(
      data.id,
      data.organizationId,
      data.workspaceId,
      Number(data.maxDailyLoss),
      Number(data.maxDrawdown),
      Number(data.maxPositionSize),
      data.maxOpenPositions,
      Number(data.marginThreshold),
      data.status,
    );

    return this.publisher.mergeObjectContext(aggregate);
  }

  async save(riskProfile: RiskProfile): Promise<void> {
    await this.prisma.riskProfile.upsert({
      where: { workspaceId: riskProfile.workspaceId },
      create: {
        id: riskProfile.id,
        organizationId: riskProfile.organizationId,
        workspaceId: riskProfile.workspaceId,
        maxDailyLoss: riskProfile.getMaxDailyLoss(),
        maxDrawdown: riskProfile.getMaxDrawdown(),
        maxPositionSize: riskProfile.getMaxPositionSize(),
        maxOpenPositions: riskProfile.getMaxOpenPositions(),
        marginThreshold: riskProfile.getMarginThreshold(),
        status: riskProfile.status,
      },
      update: {
        maxDailyLoss: riskProfile.getMaxDailyLoss(),
        maxDrawdown: riskProfile.getMaxDrawdown(),
        maxPositionSize: riskProfile.getMaxPositionSize(),
        maxOpenPositions: riskProfile.getMaxOpenPositions(),
        marginThreshold: riskProfile.getMarginThreshold(),
        status: riskProfile.status,
      },
    });

    riskProfile.commit();
  }
}
