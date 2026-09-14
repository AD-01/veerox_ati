/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProvisionAgentModal } from '../provision-agent-modal';
import * as WorkspaceContext from '../../../lib/context/workspace-context';
import * as ToastContext from '../../../lib/context/toast-context';

// Mock the contexts
jest.mock('../../../lib/context/workspace-context', () => ({
  useWorkspace: jest.fn(),
}));

jest.mock('../../../lib/context/toast-context', () => ({
  useToast: jest.fn(),
}));

describe('ProvisionAgentModal Integration Tests', () => {
  const mockShowToast = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  
  const mockConnector = {
    id: 'conn-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    name: 'Test Connector',
    provider: 'MT5',
    status: 'ACTIVE',
    connectionStatus: 'PROVISIONED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    // Setup clipboard mock
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({
      currentOrganization: { id: 'org-1' },
      currentWorkspace: { id: 'ws-1', name: 'Test Workspace' },
    });

    (ToastContext.useToast as jest.Mock).mockReturnValue({
      showToast: mockShowToast,
    });
  });

  it('renders closed when isOpen is false', () => {
    const { container } = render(
      <ProvisionAgentModal
        isOpen={false}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders provisioning prompt when open', () => {
    render(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );
    expect(screen.getByText(/Provision Agent for "Test Connector"/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Workspace:/i)).toBeInTheDocument();
    expect(screen.getByText('Test Workspace')).toBeInTheDocument();
  });

  it('handles successful provisioning and displays one-time secret', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: 'raw-secure-secret-123' }),
    });

    render(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        connector={mockConnector}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate Agent Credentials/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/connectors/conn-1/credentials/provision?organizationId=org-1&workspaceId=ws-1',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Check one-time secret revelation
    expect(await screen.findByText(/One-Time Secret Revelation/i)).toBeInTheDocument();
    expect(screen.getByText('raw-secure-secret-123')).toBeInTheDocument();
    
    // Check start command rendering
    expect(screen.getByText(/--secret raw-secure-secret-123/i)).toBeInTheDocument();
  });

  it('copies secret to clipboard and shows toast', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: 'raw-secure-secret-123' }),
    });

    render(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate Agent Credentials/i }));

    await waitFor(() => {
      expect(screen.getByText('raw-secure-secret-123')).toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('raw-secure-secret-123');
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Copied', message: 'Secret copied to clipboard' })
    );
  });

  it('handles provisioning error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Backend rejected provision' }),
    });

    render(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate Agent Credentials/i }));

    expect(await screen.findByText('Backend rejected provision')).toBeInTheDocument();
    
    // Secret UI should not render
    expect(screen.queryByText(/One-Time Secret Revelation/i)).not.toBeInTheDocument();
  });

  it('clears secret state when modal is closed', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, secret: 'raw-secure-secret-123' }),
    });

    const { rerender } = render(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate Agent Credentials/i }));

    await waitFor(() => {
      expect(screen.getByText('raw-secure-secret-123')).toBeInTheDocument();
    });

    // Click Done to close
    const doneButton = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneButton);

    expect(mockOnClose).toHaveBeenCalled();

    // Rerender as if parent component closed it and then reopened it
    rerender(
      <ProvisionAgentModal
        isOpen={true}
        onClose={mockOnClose}
        connector={mockConnector}
      />
    );

    // Secret should be gone, back to initial prompt
    expect(screen.queryByText('raw-secure-secret-123')).not.toBeInTheDocument();
    expect(screen.getByText(/Provision Agent for "Test Connector"/i)).toBeInTheDocument();
  });
});
