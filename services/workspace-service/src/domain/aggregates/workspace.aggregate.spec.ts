import { Workspace, WorkspaceStatus } from './workspace.aggregate';
import {
  WorkspaceCreatedEvent,
  WorkspaceArchivedEvent,
  WorkspaceRestoredEvent,
  WorkspaceDeletedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleUpdatedEvent
} from '@veerox/events';

describe('Workspace Aggregate', () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = Workspace.create('workspace-1', 'org-1', 'Test Workspace');
    workspace.commit(); // Clear initial created events
  });

  it('should create a workspace with ACTIVE status', () => {
    const newWorkspace = Workspace.create('w2', 'o2', 'Name');
    expect(newWorkspace.status).toBe(WorkspaceStatus.ACTIVE);
    expect(newWorkspace.getUncommittedEvents()).toHaveLength(1);
    expect(newWorkspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceCreatedEvent);
  });

  describe('Lifecycle', () => {
    it('should archive a workspace', () => {
      workspace.archive();
      expect(workspace.status).toBe(WorkspaceStatus.ARCHIVED);
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceArchivedEvent);
    });

    it('should restore an archived workspace', () => {
      workspace.archive();
      workspace.commit();
      
      workspace.restore();
      expect(workspace.status).toBe(WorkspaceStatus.ACTIVE);
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceRestoredEvent);
    });

    it('should delete a workspace', () => {
      workspace.delete();
      expect(workspace.status).toBe(WorkspaceStatus.DELETED);
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceDeletedEvent);
    });

    it('should not allow archive if deleted', () => {
      workspace.delete();
      expect(() => workspace.archive()).toThrow('Workspace is DELETED');
    });

    it('should not allow restore if deleted', () => {
      workspace.delete();
      expect(() => workspace.restore()).toThrow('Workspace is DELETED');
    });
  });

  describe('Membership', () => {
    it('should add a member', () => {
      workspace.addMember('user-1', 'Trader', 'admin-1');
      expect(workspace.memberRoles.get('user-1')).toBe('Trader');
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceMemberAddedEvent);
    });

    it('should throw if adding an existing member', () => {
      workspace.addMember('user-1', 'Trader', 'admin-1');
      workspace.commit();
      expect(() => workspace.addMember('user-1', 'Viewer', 'admin-1')).toThrow('already a member');
    });

    it('should update a member role', () => {
      workspace.addMember('user-1', 'Trader', 'admin-1');
      workspace.commit();

      workspace.updateMemberRole('user-1', 'Admin', 'admin-1');
      expect(workspace.memberRoles.get('user-1')).toBe('Admin');
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceMemberRoleUpdatedEvent);
    });

    it('should remove a member', () => {
      workspace.addMember('user-1', 'Trader', 'admin-1');
      workspace.commit();

      workspace.removeMember('user-1', 'admin-1');
      expect(workspace.memberRoles.has('user-1')).toBe(false);
      expect(workspace.getUncommittedEvents()[0]).toBeInstanceOf(WorkspaceMemberRemovedEvent);
    });

    it('should throw when updating non-existent member', () => {
      expect(() => workspace.updateMemberRole('user-missing', 'Admin', 'admin-1')).toThrow('not a member');
    });

    it('should throw when removing non-existent member', () => {
      expect(() => workspace.removeMember('user-missing', 'admin-1')).toThrow('not a member');
    });

    it('should not allow membership changes if not ACTIVE', () => {
      workspace.archive();
      expect(() => workspace.addMember('u2', 'Trader', 'admin-1')).toThrow('not ACTIVE');
      expect(() => workspace.removeMember('u1', 'admin-1')).toThrow('not ACTIVE');
      expect(() => workspace.updateMemberRole('u1', 'Role', 'admin-1')).toThrow('not ACTIVE');
    });
  });
});
