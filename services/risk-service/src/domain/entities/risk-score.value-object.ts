export class RiskScore {
  public readonly value: number;
  public readonly category: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

  private constructor(value: number) {
    if (value < 0 || value > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }
    
    this.value = Math.round(value);

    if (this.value <= 20) this.category = 'VERY_LOW';
    else if (this.value <= 40) this.category = 'LOW';
    else if (this.value <= 60) this.category = 'MODERATE';
    else if (this.value <= 80) this.category = 'HIGH';
    else this.category = 'CRITICAL';
  }

  public static create(value: number): RiskScore {
    return new RiskScore(value);
  }
}
