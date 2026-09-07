export class EffectiveLimits {
  private limits: Record<string, number> = {};
  private prohibitions: Set<string> = new Set();

  public get(key: string): number | undefined {
    return this.limits[key];
  }

  public setMinimum(key: string, value: number): void {
    if (this.limits[key] === undefined || value < this.limits[key]) {
      this.limits[key] = value;
    }
  }

  public setProhibited(key: string): void {
    this.prohibitions.add(key);
  }

  public isProhibited(key: string): boolean {
    return this.prohibitions.has(key);
  }

  public toJSON(): Record<string, unknown> {
    return {
      limits: { ...this.limits },
      prohibitions: Array.from(this.prohibitions),
    };
  }
}
