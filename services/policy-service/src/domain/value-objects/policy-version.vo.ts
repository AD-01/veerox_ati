export class PolicyVersion {
  constructor(public readonly value: number) {
    if (!Number.isInteger(value)) {
      throw new Error('Policy version must be an integer.');
    }
    if (value < 1) {
      throw new Error('Policy version must be positive.');
    }
  }

  public increment(): PolicyVersion {
    return new PolicyVersion(this.value + 1);
  }

  public equals(other: PolicyVersion): boolean {
    return this.value === other.value;
  }
}
