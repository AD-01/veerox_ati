import { AggregateRoot } from './base.aggregate';

export interface SymbolProps {
  id: string;
  providerId: string;
  brokerSymbol: string;
  standardSymbol: string;
  assetType: string;
  contractSize: number;
  tickSize: number;
  precision: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SymbolAggregate extends AggregateRoot {
  private constructor(private readonly props: SymbolProps) {
    super();
  }

  public static create(props: Omit<SymbolProps, 'id' | 'createdAt' | 'updatedAt' | 'status'>): SymbolAggregate {
    if (props.contractSize <= 0) {
      throw new Error('Contract size must be strictly positive.');
    }
    
    const id = crypto.randomUUID();
    const now = new Date();
    
    return new SymbolAggregate({
      id,
      ...props,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: SymbolProps): SymbolAggregate {
    return new SymbolAggregate(props);
  }

  get id(): string { return this.props.id; }
  get providerId(): string { return this.props.providerId; }
  get brokerSymbol(): string { return this.props.brokerSymbol; }
  get standardSymbol(): string { return this.props.standardSymbol; }
  get assetType(): string { return this.props.assetType; }
  get contractSize(): number { return this.props.contractSize; }
  get tickSize(): number { return this.props.tickSize; }
  get precision(): number { return this.props.precision; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public deactivate(): void {
    if (this.props.status === 'INACTIVE') {
      throw new Error('Symbol is already inactive');
    }
    this.props.status = 'INACTIVE';
    this.props.updatedAt = new Date();
  }
}
