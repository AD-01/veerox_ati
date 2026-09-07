import { AggregateRoot } from '@nestjs/cqrs';
import { RiskProfileConfiguredEvent } from '@veerox/events';

export class RiskProfile extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    private maxDailyLoss: number,
    private maxDrawdown: number,
    private maxPositionSize: number,
    private maxOpenPositions: number,
    private marginThreshold: number,
    public readonly status: string,
  ) {
    super();
  }

  public configureLimits(
    maxDailyLoss: number,
    maxDrawdown: number,
    maxPositionSize: number,
    maxOpenPositions: number,
    marginThreshold: number,
    actorId: string,
  ): void {
    this.maxDailyLoss = maxDailyLoss;
    this.maxDrawdown = maxDrawdown;
    this.maxPositionSize = maxPositionSize;
    this.maxOpenPositions = maxOpenPositions;
    this.marginThreshold = marginThreshold;

    this.apply(
      new RiskProfileConfiguredEvent(
        this.workspaceId,
        this.maxDailyLoss,
        this.maxDrawdown,
        this.maxPositionSize,
        this.maxOpenPositions,
        this.marginThreshold,
        actorId,
      ),
    );
  }

  // Getters for persistence
  public getMaxDailyLoss(): number { return this.maxDailyLoss; }
  public getMaxDrawdown(): number { return this.maxDrawdown; }
  public getMaxPositionSize(): number { return this.maxPositionSize; }
  public getMaxOpenPositions(): number { return this.maxOpenPositions; }
  public getMarginThreshold(): number { return this.marginThreshold; }
}
