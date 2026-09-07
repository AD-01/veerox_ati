import { DomainEvent, PolicyCreatedEvent, PolicyUpdatedEvent, PolicyActivatedEvent, PolicyDeactivatedEvent } from '@veerox/events';
import { PolicyVersion } from '../value-objects/policy-version.vo';
import { PolicyPriority } from '../value-objects/policy-priority.vo';
import { PolicyName } from '../value-objects/policy-name.vo';
import { PolicyRule } from '../entities/policy-rule.entity';
import * as crypto from 'crypto';

export type PolicyScope = 'ORGANIZATION' | 'WORKSPACE' | 'ACCOUNT' | 'STRATEGY' | 'SYMBOL';
export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export class PolicyAggregate {
  private _uncommittedEvents: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    private _name: PolicyName,
    public description: string | null,
    public readonly scope: PolicyScope,
    private _status: PolicyStatus,
    private _priority: PolicyPriority,
    private _version: PolicyVersion,
    private _rules: PolicyRule[],
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  public get uncommittedEvents(): readonly DomainEvent[] {
    return this._uncommittedEvents;
  }

  public clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  protected apply(event: DomainEvent): void {
    this._uncommittedEvents.push(event);
  }

  // Getters for primitives
  public get name(): string { return this._name.value; }
  public get status(): string { return this._status; }
  public get priority(): number { return this._priority.value; }
  public get version(): number { return this._version.value; }
  public get rules(): readonly PolicyRule[] { return this._rules; }

  public static create(
    organizationId: string,
    workspaceId: string,
    nameStr: string,
    description: string | null,
    scope: PolicyScope,
    priorityNum: number,
  ): PolicyAggregate {
    const id = crypto.randomUUID();
    const name = new PolicyName(nameStr);
    const priority = new PolicyPriority(priorityNum);
    const version = new PolicyVersion(1);
    const now = new Date();

    const policy = new PolicyAggregate(
      id,
      organizationId,
      workspaceId,
      name,
      description,
      scope,
      'DRAFT',
      priority,
      version,
      [],
      now,
      now,
    );

    policy.apply(new PolicyCreatedEvent(
      id,
      organizationId,
      workspaceId,
      name.value,
      scope,
      priority.value,
      version.value,
      now,
    ));

    return policy;
  }

  public activate(): void {
    if (this._status === 'ACTIVE') {
      return;
    }
    if (this._status === 'DRAFT' || this._status === 'INACTIVE') {
      this._status = 'ACTIVE';
      this.updatedAt = new Date();
      this.apply(new PolicyActivatedEvent(
        this.id,
        this.organizationId,
        this.workspaceId,
        this._version.value,
        this.updatedAt,
      ));
    }
  }

  public deactivate(): void {
    if (this._status === 'INACTIVE') {
      return;
    }
    if (this._status === 'ACTIVE') {
      this._status = 'INACTIVE';
      this.updatedAt = new Date();
      this.apply(new PolicyDeactivatedEvent(
        this.id,
        this.organizationId,
        this.workspaceId,
        this._version.value,
        this.updatedAt,
      ));
    } else {
      throw new Error('Can only deactivate an active policy.');
    }
  }

  public addRule(rule: PolicyRule): void {
    this._rules.push(rule);
    this._version = this._version.increment();
    this.updatedAt = new Date();

    this.apply(new PolicyUpdatedEvent(
      this.id,
      this.organizationId,
      this.workspaceId,
      this._version.value,
      this.updatedAt,
    ));
  }
}
