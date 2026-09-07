export interface PolicyEvaluationRecord {
  id: string;
  decisionId: string;
  policyId: string;
  correlationId: string;
  organizationId: string;
  workspaceId: string;
  outcome: 'ALLOW' | 'REJECT';
  policyVersion: number;
  violations: unknown[];
  effectiveLimits: Record<string, unknown>;
  explanation: Record<string, unknown>;
  createdAt: Date;
}

export interface IPolicyEvaluationRepository {
  save(evaluation: PolicyEvaluationRecord): Promise<void>;
  findByCorrelationId(organizationId: string, workspaceId: string, correlationId: string): Promise<PolicyEvaluationRecord[]>;
  findByDecisionId(organizationId: string, workspaceId: string, decisionId: string): Promise<PolicyEvaluationRecord[]>;
}
