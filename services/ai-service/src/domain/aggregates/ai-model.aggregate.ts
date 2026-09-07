import { AggregateRoot } from '@nestjs/cqrs';

export interface AIModelProps {
  id: string;
  organizationId: string;
  workspaceId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AIModel extends AggregateRoot {
  private constructor(private readonly props: AIModelProps) {
    super();
  }

  public get id(): string {
    return this.props.id;
  }
  
  public get organizationId(): string {
    return this.props.organizationId;
  }
  
  public get workspaceId(): string {
    return this.props.workspaceId;
  }

  public get provider(): string {
    return this.props.provider;
  }
  
  public get modelName(): string {
    return this.props.modelName;
  }
  
  public get modelVersion(): string {
    return this.props.modelVersion;
  }
  
  public get status(): string {
    return this.props.status;
  }

  public get properties(): Readonly<AIModelProps> {
    return Object.freeze({ ...this.props });
  }

  public static create(props: AIModelProps): AIModel {
    return new AIModel(props);
  }

  public static reconstitute(props: AIModelProps): AIModel {
    return new AIModel(props);
  }
}
