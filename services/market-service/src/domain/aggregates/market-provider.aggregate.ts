import { AggregateRoot } from './base.aggregate';

export interface MarketProviderProps {
  id: string;
  name: string;
  type: string;
  config: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MarketProviderAggregate extends AggregateRoot {
  private constructor(private readonly props: MarketProviderProps) {
    super();
  }

  public static create(props: Omit<MarketProviderProps, 'id' | 'createdAt' | 'updatedAt' | 'status'>): MarketProviderAggregate {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const provider = new MarketProviderAggregate({
      id,
      ...props,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    return provider;
  }

  public static reconstitute(props: MarketProviderProps): MarketProviderAggregate {
    return new MarketProviderAggregate(props);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): string { return this.props.type; }
  get config(): string { return this.props.config; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public updateConfig(newConfig: string): void {
    this.props.config = newConfig;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    if (this.props.status === 'INACTIVE') {
      throw new Error('Market provider is already inactive');
    }
    this.props.status = 'INACTIVE';
    this.props.updatedAt = new Date();
  }
}
