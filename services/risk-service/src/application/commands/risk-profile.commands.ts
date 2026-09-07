export class ConfigureRiskProfileCommand {
  constructor(
    public readonly workspaceId: string,
    public readonly maxDailyLoss: number,
    public readonly maxDrawdown: number,
    public readonly maxPositionSize: number,
    public readonly maxOpenPositions: number,
    public readonly marginThreshold: number,
    public readonly actorId: string,
  ) {}
}
