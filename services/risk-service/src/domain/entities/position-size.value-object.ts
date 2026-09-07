export class PositionSize {
  public readonly value: number;

  private constructor(value: number) {
    if (value <= 0) {
      throw new Error('Position size must be greater than zero');
    }
    
    // In MetaTrader and standard brokers, position size is usually bounded by lot step
    // e.g., 0.01 is standard. For this value object we ensure it's a valid number.
    this.value = Number(value.toFixed(2));
  }

  public static create(value: number): PositionSize {
    return new PositionSize(value);
  }
}
