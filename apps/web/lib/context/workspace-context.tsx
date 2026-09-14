'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency?: string;
  timezone?: string;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  automationMode?: 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';
}

interface WorkspaceContextValue {
  organizations: Organization[];
  workspaces: Workspace[];
  currentOrganization: Organization | null;
  currentWorkspace: Workspace | null;
  selectWorkspace: (workspaceId: string) => void;
  selectOrganization: (organizationId: string) => void;
  isLoading: boolean;
  reloadTenants: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadTenants = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setWorkspaces([]);
      setCurrentOrganization(null);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch organizations
      const orgsRes = await fetch('/api/organizations').catch(() => null);
      let orgList: Organization[] = [];
      if (orgsRes && orgsRes.ok) {
        const orgData = await orgsRes.json();
        if (orgData && Array.isArray(orgData)) {
          orgList = orgData;
        } else if (orgData && Array.isArray(orgData.data)) {
          orgList = orgData.data;
        }
      }

      // Default mock org fallback if fresh user has no orgs yet
      if (orgList.length === 0) {
        orgList = [
          {
            id: 'org-default-primary',
            name: 'Primary Trading Org',
            slug: 'primary-trading-org',
            currency: 'USD',
          },
        ];
      }
      setOrganizations(orgList);

      const activeOrg = orgList[0];
      setCurrentOrganization(activeOrg);

      // 2. Fetch workspaces for active organization
      const wsRes = await fetch(`/api/organizations/${activeOrg.id}/workspaces`).catch(() => null);
      let wsList: Workspace[] = [];
      if (wsRes && wsRes.ok) {
        const wsData = await wsRes.json();
        if (wsData && Array.isArray(wsData)) {
          wsList = wsData;
        } else if (wsData && Array.isArray(wsData.data)) {
          wsList = wsData.data;
        }
      }

      if (wsList.length === 0) {
        wsList = [
          {
            id: 'ws-main-quant',
            name: 'Main Quant Workspace',
            organizationId: activeOrg.id,
            automationMode: 'FULL_AUTO',
          },
          {
            id: 'ws-backtest-sandbox',
            name: 'Backtest Sandbox',
            organizationId: activeOrg.id,
            automationMode: 'MANUAL',
          },
        ];
      }
      setWorkspaces(wsList);

      // Restore previously saved workspace ID from localStorage if available
      const savedWsId = typeof window !== 'undefined' ? localStorage.getItem('ati_active_workspace_id') : null;
      const foundWs = wsList.find(w => w.id === savedWsId) || wsList[0];
      setCurrentWorkspace(foundWs);

      if (typeof window !== 'undefined' && foundWs) {
        localStorage.setItem('ati_active_workspace_id', foundWs.id);
        localStorage.setItem('ati_active_organization_id', activeOrg.id);
      }
    } catch {
      // Fallback safe state
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const selectWorkspace = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setCurrentWorkspace(ws);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ati_active_workspace_id', ws.id);
      }
    }
  };

  const selectOrganization = (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ati_active_organization_id', org.id);
      }
      // Re-filter or reload workspaces for new organization
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        organizations,
        workspaces,
        currentOrganization,
        currentWorkspace,
        selectWorkspace,
        selectOrganization,
        isLoading,
        reloadTenants: loadTenants,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
