export class PolicyName {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Policy name cannot be empty.');
    }
    if (value.length > 255) {
      throw new Error('Policy name cannot exceed 255 characters.');
    }
  }

  public equals(other: PolicyName): boolean {
    return this.value === other.value;
  }
}
