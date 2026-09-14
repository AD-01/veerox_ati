import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminMembersPage from '../members/page';
import AdminWorkspacesPage from '../workspaces/page';
import AdminAuditLogsPage from '../audit-logs/page';

// Mock the Workspace Context
jest.mock('../../../../lib/context/workspace-context', () => ({
  useWorkspace: () => ({
    currentOrganization: { id: 'org-1', name: 'Test Org' }
  })
}));

describe('Admin Panel Hardening Tests', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Members Page', () => {
    it('should parse and map OrganizationMemberDto strictly', async () => {
      const mockMembers = [{
        organizationId: 'org-1',
        userId: 'user-1',
        joinedAt: new Date().toISOString(),
        status: 'ACTIVE',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'tester',
          firstName: 'Test',
          lastName: 'User'
        }
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembers
      });

      render(<AdminMembersPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      });
    });

    it('should handle undefined/malformed fields securely without fake defaults', async () => {
      const mockMembers = [{
        organizationId: 'org-1',
        userId: 'user-2',
        // Missing status deliberately
        user: {
          id: 'user-2'
        }
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembers
      });

      render(<AdminMembersPage />);
      
      await waitFor(() => {
        expect(screen.getByText('-')).toBeInTheDocument(); // fallback for email
        // No fake "Active"
      });
    });

    it('should handle unauthorized revoke attempts (403)', async () => {
      const mockMembers = [{
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'ACTIVE',
        user: { firstName: 'Test', lastName: 'User' }
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembers
      });

      render(<AdminMembersPage />);
      await waitFor(() => screen.getByText('Test User'));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      fireEvent.click(screen.getByText('Revoke'));
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('You do not have permission to revoke members.');
      });
    });

    it('should refresh data after successful revoke', async () => {
      const mockMembers = [{
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'ACTIVE',
        user: { firstName: 'Test', lastName: 'User' }
      }];
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockMembers }) // initial load
        .mockResolvedValueOnce({ ok: true }) // delete request
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // refresh load

      render(<AdminMembersPage />);
      await waitFor(() => screen.getByText('Test User'));

      fireEvent.click(screen.getByText('Revoke'));
      
      await waitFor(() => {
        expect(screen.getByText('No members found.')).toBeInTheDocument();
      });
    });

    it('should handle 401/403 loading errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      render(<AdminMembersPage />);
      
      await waitFor(() => {
        expect(screen.getByText('You do not have permission to view members.')).toBeInTheDocument();
      });
    });
  });

  describe('Workspaces Page', () => {
    it('should map WorkspaceDto safely without fake automation fallback', async () => {
      const mockWorkspaces = [{
        id: 'ws-1',
        name: 'Alpha Trading',
        status: 'ACTIVE',
        configuration: {
          automationMode: 'FULL_AUTO'
        }
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces
      });

      render(<AdminWorkspacesPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Alpha Trading')).toBeInTheDocument();
        expect(screen.getByText('FULL_AUTO')).toBeInTheDocument();
      });
    });

    it('should prevent tenant ID manipulation by not passing untrusted ID to API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AdminWorkspacesPage />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/organizations/org-1/workspaces');
      });
    });

    it('should render Not Configured if automationMode is missing', async () => {
      const mockWorkspaces = [{
        id: 'ws-2',
        name: 'Beta Trading',
        status: 'INACTIVE',
        configuration: {}
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces
      });

      render(<AdminWorkspacesPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Not Configured')).toBeInTheDocument();
      });
    });
  });

  describe('Audit Logs Page', () => {
    it('should handle pagination parameters correctly for page 1, 2, and 3', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => []
      });

      render(<AdminAuditLogsPage />);
      
      // Page 1
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/organizations/org-1/audit-logs?limit=50&offset=0');
      });
      (global.fetch as jest.Mock).mockClear();

      // Page 2
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/organizations/org-1/audit-logs?limit=50&offset=50');
      });
      (global.fetch as jest.Mock).mockClear();

      // Page 3
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/organizations/org-1/audit-logs?limit=50&offset=100');
      });
    });

    it('should display - when reason is missing instead of a fake default', async () => {
      const mockLogs = [{
        id: 'log-1',
        action: 'UPDATE',
        actorId: 'user-1',
        timestamp: new Date().toISOString()
        // No reason provided
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLogs
      });

      render(<AdminAuditLogsPage />);
      
      await waitFor(() => {
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
      });
    });
  });
});
