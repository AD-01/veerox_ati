/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { IPolicyRepository } from '../../domain/interfaces/policy.repository.interface';
import { PolicyAggregate, PolicyScope, PolicyStatus } from '../../domain/aggregates/policy.aggregate';
import { PolicyVersion } from '../../domain/value-objects/policy-version.vo';
import { PolicyPriority } from '../../domain/value-objects/policy-priority.vo';
import { PolicyName } from '../../domain/value-objects/policy-name.vo';
import { PolicyRule, PolicyRuleType } from '../../domain/entities/policy-rule.entity';

export class PrismaPolicyRepository implements IPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(dbPolicy: any): PolicyAggregate {
    const rules = dbPolicy.rules.map((r: any) => new PolicyRule(
      r.id,
      r.policyId,
      r.ruleType as PolicyRuleType,
      r.operator,
      r.value,
      r.unit,
      r.enabled,
      r.priority,
      JSON.parse(r.configuration),
      r.createdAt,
      r.updatedAt,
    ));
    
    return new PolicyAggregate(
      dbPolicy.id,
      dbPolicy.organizationId,
      dbPolicy.workspaceId,
      new PolicyName(dbPolicy.name),
      dbPolicy.description,
      dbPolicy.scope as PolicyScope,
      dbPolicy.status as PolicyStatus,
      new PolicyPriority(dbPolicy.priority),
      new PolicyVersion(dbPolicy.version),
      rules,
      dbPolicy.createdAt,
      dbPolicy.updatedAt,
    );
  }

  async save(policy: PolicyAggregate): Promise<void> {
    const rulesData = policy.rules.map(r => ({
      id: r.id,
      ruleType: r.ruleType,
      operator: r.operator,
      value: r.value,
      unit: r.unit,
      enabled: r.enabled,
      priority: r.priority,
      configuration: JSON.stringify(r.configuration),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    await this.prisma.policy.upsert({
      where: {
        id: policy.id,
      },
      create: {
        id: policy.id,
        organizationId: policy.organizationId,
        workspaceId: policy.workspaceId,
        name: policy.name,
        description: policy.description,
        scope: policy.scope,
        status: policy.status,
        priority: policy.priority,
        version: policy.version,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
        rules: {
          create: rulesData,
        },
      },
      update: {
        name: policy.name,
        description: policy.description,
        scope: policy.scope,
        status: policy.status,
        priority: policy.priority,
        version: policy.version,
        updatedAt: policy.updatedAt,
        rules: {
          deleteMany: {},
          create: rulesData,
        },
      },
    });
  }

  async findById(organizationId: string, workspaceId: string, id: string): Promise<PolicyAggregate | null> {
    const dbPolicy = await this.prisma.policy.findUnique({
      where: { id },
      include: { rules: true },
    });

    if (!dbPolicy || dbPolicy.organizationId !== organizationId || dbPolicy.workspaceId !== workspaceId) {
      return null;
    }

    return this.mapToDomain(dbPolicy);
  }

  async findByWorkspace(organizationId: string, workspaceId: string): Promise<PolicyAggregate[]> {
    const dbPolicies = await this.prisma.policy.findMany({
      where: {
        organizationId,
        workspaceId,
      },
      include: { rules: true },
    });

    return dbPolicies.map(p => this.mapToDomain(p));
  }

  async findActivePolicies(organizationId: string, workspaceId: string): Promise<PolicyAggregate[]> {
    const dbPolicies = await this.prisma.policy.findMany({
      where: {
        organizationId,
        workspaceId,
        status: 'ACTIVE',
      },
      include: { rules: true },
    });

    return dbPolicies.map(p => this.mapToDomain(p));
  }
}
