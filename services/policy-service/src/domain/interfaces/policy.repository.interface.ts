import { PolicyAggregate } from '../aggregates/policy.aggregate';

export interface IPolicyRepository {
  save(policy: PolicyAggregate): Promise<void>;
  findById(organizationId: string, workspaceId: string, id: string): Promise<PolicyAggregate | null>;
  findByWorkspace(organizationId: string, workspaceId: string): Promise<PolicyAggregate[]>;
  findActivePolicies(organizationId: string, workspaceId: string): Promise<PolicyAggregate[]>;
}
