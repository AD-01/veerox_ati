import { PolicyAggregate } from './policy.aggregate';
import { PolicyRule } from '../entities/policy-rule.entity';

describe('PolicyAggregate', () => {
  const orgId = 'org-123';
  const workspaceId = 'ws-456';

  describe('create', () => {
    it('should create a valid DRAFT policy and emit PolicyCreatedEvent', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Max Risk Policy', 'Limits risk', 'WORKSPACE', 10);
      
      expect(policy.name).toBe('Max Risk Policy');
      expect(policy.status).toBe('DRAFT');
      expect(policy.priority).toBe(10);
      expect(policy.version).toBe(1);
      
      const uncommitted = policy.uncommittedEvents;
      expect(uncommitted).toHaveLength(1);
      expect(uncommitted[0].constructor.name).toBe('PolicyCreatedEvent');
    });

    it('should throw an error for empty policy name', () => {
      expect(() => {
        PolicyAggregate.create(orgId, workspaceId, '', null, 'WORKSPACE', 10);
      }).toThrow('Policy name cannot be empty');
    });

    it('should throw an error for negative priority', () => {
      expect(() => {
        PolicyAggregate.create(orgId, workspaceId, 'Valid Name', null, 'WORKSPACE', -1);
      }).toThrow('Policy priority must be between 0 and 1000');
    });
  });

  describe('activate', () => {
    it('should transition from DRAFT to ACTIVE and emit PolicyActivatedEvent', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Test Policy', null, 'WORKSPACE', 10);
      policy.clearUncommittedEvents();
      
      policy.activate();
      
      expect(policy.status).toBe('ACTIVE');
      const uncommitted = policy.uncommittedEvents;
      expect(uncommitted).toHaveLength(1);
      expect(uncommitted[0].constructor.name).toBe('PolicyActivatedEvent');
    });

    it('should ignore duplicate activate calls', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Test Policy', null, 'WORKSPACE', 10);
      policy.activate();
      policy.clearUncommittedEvents();
      
      policy.activate();
      expect(policy.uncommittedEvents).toHaveLength(0);
    });
  });

  describe('deactivate', () => {
    it('should transition from ACTIVE to INACTIVE and emit PolicyDeactivatedEvent', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Test Policy', null, 'WORKSPACE', 10);
      policy.activate();
      policy.clearUncommittedEvents();
      
      policy.deactivate();
      
      expect(policy.status).toBe('INACTIVE');
      const uncommitted = policy.uncommittedEvents;
      expect(uncommitted).toHaveLength(1);
      expect(uncommitted[0].constructor.name).toBe('PolicyDeactivatedEvent');
    });

    it('should throw error if deactivating DRAFT policy', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Test Policy', null, 'WORKSPACE', 10);
      
      expect(() => {
        policy.deactivate();
      }).toThrow('Can only deactivate an active policy');
    });
  });

  describe('addRule', () => {
    it('should add a rule, increment version and emit PolicyUpdatedEvent', () => {
      const policy = PolicyAggregate.create(orgId, workspaceId, 'Test Policy', null, 'WORKSPACE', 10);
      policy.clearUncommittedEvents();
      
      const rule = new PolicyRule('rule-1', policy.id, 'MAX_POSITION_SIZE', 'LTE', '1000', 'USD', true, 10, {}, new Date(), new Date());
      policy.addRule(rule);
      
      expect(policy.rules).toHaveLength(1);
      expect(policy.version).toBe(2);
      
      const uncommitted = policy.uncommittedEvents;
      expect(uncommitted).toHaveLength(1);
      expect(uncommitted[0].constructor.name).toBe('PolicyUpdatedEvent');
    });
  });
});
