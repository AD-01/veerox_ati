import { BaseAggregateRoot } from './base.aggregate';
import {
  WorkspaceCreatedEvent,
  WorkspaceUpdatedEvent,
  WorkspaceArchivedEvent,
  WorkspaceSettingsChangedEvent,
  WorkspaceRestoredEvent,
  WorkspaceDeletedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleUpdatedEvent,
} from '@veerox/events';
import { WorkspaceConfig, WorkspaceConfigProps } from '../value-objects/workspace-config.vo';

export enum WorkspaceStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export interface WorkspaceProps {
  id: string;
  organizationId: string;
  name: string;
  status: WorkspaceStatus;
  createdAt: Date;
  configuration?: WorkspaceConfig;
  memberRoles?: Map<string, string>;
}

export class Workspace extends BaseAggregateRoot {
  private props: WorkspaceProps;

  private constructor(props: WorkspaceProps) {
    super();
    this.props = props;
  }

  public static create(
    id: string,
    organizationId: string,
    name: string,
    initialConfigProps?: WorkspaceConfigProps
  ): Workspace {
    const defaultSettings: WorkspaceConfigProps = initialConfigProps || {
      tradingPolicies: '{}',
      riskLimits: '{}',
      notificationSettings: '{}',
      strategyPreferences: '{}',
      automationMode: 'MANUAL',
    };

    const props: WorkspaceProps = {
      id,
      organizationId,
      name,
      status: WorkspaceStatus.ACTIVE,
      createdAt: new Date(),
      configuration: WorkspaceConfig.create(defaultSettings),
      memberRoles: new Map<string, string>(),
    };

    const workspace = new Workspace(props);

    workspace.apply(
      new WorkspaceCreatedEvent(
        workspace.props.id,
        workspace.props.organizationId,
        workspace.props.name,
        workspace.props.createdAt,
      ),
    );

    return workspace;
  }

  public static load(props: WorkspaceProps): Workspace {
    return new Workspace(props);
  }

  public updateName(name: string): void {
    this.ensureActive();

    if (this.props.name !== name) {
      this.props.name = name;
      this.apply(
        new WorkspaceUpdatedEvent(this.props.id, new Date()),
      );
    }
  }

  public archive(): void {
    if (this.props.status === WorkspaceStatus.ARCHIVED) {
      return;
    }
    this.ensureNotDeleted();
    this.props.status = WorkspaceStatus.ARCHIVED;

    this.apply(
      new WorkspaceArchivedEvent(this.props.id, new Date()),
    );
  }

  public restore(): void {
    if (this.props.status === WorkspaceStatus.ACTIVE) {
      return;
    }
    this.ensureNotDeleted();
    this.props.status = WorkspaceStatus.ACTIVE;

    this.apply(
      new WorkspaceRestoredEvent(this.props.id, new Date()),
    );
  }

  public delete(): void {
    if (this.props.status === WorkspaceStatus.DELETED) {
      return;
    }
    this.props.status = WorkspaceStatus.DELETED;

    this.apply(
      new WorkspaceDeletedEvent(this.props.id, new Date()),
    );
  }

  public updateSettings(newSettings: Partial<WorkspaceConfigProps>): void {
    this.ensureActive();

    if (this.props.configuration) {
      this.props.configuration = this.props.configuration.update(newSettings);
    } else {
      // Should not normally happen if created properly
      this.props.configuration = WorkspaceConfig.create({
        tradingPolicies: newSettings.tradingPolicies || '{}',
        riskLimits: newSettings.riskLimits || '{}',
        notificationSettings: newSettings.notificationSettings || '{}',
        strategyPreferences: newSettings.strategyPreferences || '{}',
        automationMode: newSettings.automationMode || 'MANUAL',
      });
    }

    this.apply(
      new WorkspaceSettingsChangedEvent(
        this.props.id,
        this.props.configuration.toPrimitive() as unknown as Record<string, unknown>,
        new Date()
      )
    );
  }

  public addMember(userId: string, role: string, actorId: string): void {
    this.ensureActive();
    
    if (!this.props.memberRoles) {
      this.props.memberRoles = new Map<string, string>();
    }

    if (this.props.memberRoles.has(userId)) {
      throw new Error(`User ${userId} is already a member of workspace ${this.props.id}`);
    }

    this.props.memberRoles.set(userId, role);
    this.apply(
      new WorkspaceMemberAddedEvent(this.props.id, userId, actorId, new Date()),
    );
  }

  public removeMember(userId: string, actorId: string): void {
    this.ensureActive();

    if (!this.props.memberRoles || !this.props.memberRoles.has(userId)) {
      throw new Error(`User ${userId} is not a member of workspace ${this.props.id}`);
    }

    this.props.memberRoles.delete(userId);
    this.apply(
      new WorkspaceMemberRemovedEvent(this.props.id, userId, actorId, new Date()),
    );
  }

  public updateMemberRole(userId: string, role: string, actorId: string): void {
    this.ensureActive();

    if (!this.props.memberRoles || !this.props.memberRoles.has(userId)) {
      throw new Error(`User ${userId} is not a member of workspace ${this.props.id}`);
    }

    this.props.memberRoles.set(userId, role);
    this.apply(
      new WorkspaceMemberRoleUpdatedEvent(this.props.id, userId, role, actorId, new Date()),
    );
  }

  private ensureActive(): void {
    if (this.props.status !== WorkspaceStatus.ACTIVE) {
      throw new Error('Workspace is not ACTIVE');
    }
  }

  private ensureNotDeleted(): void {
    if (this.props.status === WorkspaceStatus.DELETED) {
      throw new Error('Workspace is DELETED');
    }
  }

  // Getters
  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get name(): string { return this.props.name; }
  get status(): WorkspaceStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get configuration(): WorkspaceConfig | undefined { return this.props.configuration; }
  get memberRoles(): Map<string, string> { return this.props.memberRoles || new Map<string, string>(); }
}
