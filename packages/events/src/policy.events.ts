import { DomainEvent } from './index';

export class PolicyCreatedEvent extends DomainEvent {
  constructor(
    public readonly policyId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly scope: string,
    public readonly priority: number,
    public readonly version: number,
    public readonly createdAt: Date,
  ) {
    super();
  }
}

export class PolicyUpdatedEvent extends DomainEvent {
  constructor(
    public readonly policyId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly version: number,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}

export class PolicyActivatedEvent extends DomainEvent {
  constructor(
    public readonly policyId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly version: number,
    public readonly activatedAt: Date,
  ) {
    super();
  }
}

export class PolicyDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly policyId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly version: number,
    public readonly deactivatedAt: Date,
  ) {
    super();
  }
}

export interface EventPolicyViolation {
  ruleId: string;
  ruleType: string;
  field: string;
  actualValue: string | number | boolean;
  configuredValue: string | number | boolean;
  operator: string;
  severity: string;
  reason: string;
}

export interface EventEffectiveLimits {
  limits: Record<string, number | string | boolean>;
  prohibitions: string[];
}

export class PolicyEvaluatedEvent extends DomainEvent {
  constructor(
    public readonly evaluationId: string,
    public readonly policyId: string,
    public readonly policyVersion: number,
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly outcome: string,
    public readonly effectiveLimits: EventEffectiveLimits,
    public readonly violations: EventPolicyViolation[],
    public readonly evaluatedRules: string[],
    public readonly explanation: Record<string, unknown>,
    public readonly evaluatedAt: Date,
  ) {
    super();
  }
}

export class PolicyEvaluationCompletedEvent extends DomainEvent {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly expectedPolicyCount: number,
    public readonly evaluatedPolicyIds: string[],
    public readonly completedAt: Date,
  ) {
    super();
  }
}

export class PolicyDecisionResolvedEvent extends DomainEvent {
  constructor(
    public readonly resolutionId: string,
    public readonly correlationId: string,
    public readonly decisionId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly policyOutcome: string,
    public readonly effectiveLimits: EventEffectiveLimits,
    public readonly violations: EventPolicyViolation[],
    public readonly policyEvaluationIds: string[],
    public readonly timestamp: Date,
  ) {
    super();
  }
}
