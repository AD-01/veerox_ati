/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaPolicyRepository } from './prisma-policy.repository';
import { PrismaClient } from '@prisma/client';
import { PolicyAggregate } from '../../domain/aggregates/policy.aggregate';

describe('PrismaPolicyRepository', () => {
  let repository: PrismaPolicyRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      policy: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    repository = new PrismaPolicyRepository(mockPrisma as unknown as PrismaClient);
  });

  it('should correctly map aggregate to prisma upsert format', async () => {
    const policy = PolicyAggregate.create('org-1', 'ws-1', 'Test', null, 'WORKSPACE', 5);
    
    await repository.save(policy);
    
    expect(mockPrisma.policy.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: policy.id },
      create: expect.objectContaining({
        id: policy.id,
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        name: 'Test',
      })
    }));
  });

  it('should reconstitute aggregate from prisma model', async () => {
    const dbPolicy = {
      id: 'pol-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Loaded',
      description: null,
      scope: 'WORKSPACE',
      status: 'ACTIVE',
      priority: 10,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: [],
    };
    
    mockPrisma.policy.findUnique.mockResolvedValue(dbPolicy);
    
    const policy = await repository.findById('org-1', 'ws-1', 'pol-1');
    expect(policy).not.toBeNull();
    expect(policy?.name).toBe('Loaded');
    expect(policy?.status).toBe('ACTIVE');
    expect(policy?.version).toBe(2);
  });
  
  it('should enforce tenant isolation in findById', async () => {
    const dbPolicy = {
      id: 'pol-1',
      organizationId: 'org-2', // Different org
      workspaceId: 'ws-1',
      name: 'Loaded',
      description: null,
      scope: 'WORKSPACE',
      status: 'ACTIVE',
      priority: 10,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: [],
    };
    
    mockPrisma.policy.findUnique.mockResolvedValue(dbPolicy);
    
    const policy = await repository.findById('org-1', 'ws-1', 'pol-1');
    expect(policy).toBeNull();
  });
});
