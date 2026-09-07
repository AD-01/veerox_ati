export class CalculateCorrelationCommand {
  constructor(
    public readonly timeframe: string,
    public readonly limit: number = 30,
  ) {}
}
