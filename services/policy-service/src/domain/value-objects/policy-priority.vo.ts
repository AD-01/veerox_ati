export class PolicyPriority {
  constructor(public readonly value: number) {
    if (!Number.isInteger(value)) {
      throw new Error('Policy priority must be an integer.');
    }
    if (value < 0 || value > 1000) {
      throw new Error('Policy priority must be between 0 and 1000.');
    }
  }

  public equals(other: PolicyPriority): boolean {
    return this.value === other.value;
  }
}
