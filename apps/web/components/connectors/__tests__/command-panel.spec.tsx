import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandPanel } from '../command-panel';
import { useWorkspace } from '../../../lib/context/workspace-context';

jest.mock('../../../lib/context/workspace-context', () => ({
  useWorkspace: jest.fn(),
}));

const mockConnectors = [
  {
    id: 'conn-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    name: 'Test Connector 1',
    provider: 'MT5',
    status: 'ACTIVE',
    connectionStatus: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'conn-2',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    name: 'Test Connector 2',
    provider: 'MT5',
    status: 'ACTIVE',
    connectionStatus: 'DISCONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const mockCommands = [
  {
    id: 'cmd-1',
    connectorId: 'conn-1',
    commandType: 'DEPLOY_EA',
    payloadJson: '{"eaName":"TestEA"}',
    status: 'PENDING',
    retries: 0,
    sequenceNumber: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cmd-2',
    connectorId: 'conn-1',
    commandType: 'RAW',
    payloadJson: '{"raw":"data"}',
    status: 'PROCESSED',
    retries: 0,
    sequenceNumber: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cmd-3',
    connectorId: 'conn-1',
    commandType: 'DEPLOY_EA',
    payloadJson: '{"bad":"data"}',
    status: 'FAILED',
    retries: 3,
    sequenceNumber: 3,
    createdAt: new Date().toISOString(),
  }
];

describe('CommandPanel Component', () => {
  beforeEach(() => {
    (useWorkspace as jest.Mock).mockReturnValue({
      currentOrganization: { id: 'org-1' },
      currentWorkspace: { id: 'ws-1' },
    });
    
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.includes('/commands?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockCommands, metadata: { totalRecords: 3 } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    }) as jest.Mock;
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders EA Deploy tab and handles empty connectors', () => {
    render(<CommandPanel connectors={[]} />);
    expect(screen.getByText('No Connectors Registered')).toBeInTheDocument();
  });

  it('renders connector selection and initial fetch', async () => {
    render(<CommandPanel connectors={mockConnectors} />);
    
    expect(screen.getByRole('button', { name: 'Dispatch Command' })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('PROCESSED')).toBeInTheDocument();
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/connectors/conn-1/commands?organizationId=org-1&workspaceId=ws-1'),
      expect.anything()
    );
  });

  it('aborts active requests on unmount or connector switch', async () => {
    const { unmount } = render(<CommandPanel connectors={mockConnectors} />);
    
    // Switch connector
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'conn-2' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/connectors/conn-2/commands?organizationId=org-1&workspaceId=ws-1'),
        expect.anything()
      );
    });
    
    unmount();
    // After unmount, no interval should remain active
    expect(jest.getTimerCount()).toBe(0);
  });

  it('submits a command payload successfully', async () => {
    let getCallCount = 0;
    let finalJsonResolve: (value: any) => void;
    const finalJsonPromise = new Promise(r => finalJsonResolve = r);
    
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      getCallCount++;
      if (getCallCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: mockCommands }) });
      }
      return Promise.resolve({ ok: true, json: () => finalJsonPromise });
    });

    render(<CommandPanel connectors={mockConnectors} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dispatch Command' })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: 'Dispatch Command' });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Command dispatched successfully.')).toBeInTheDocument();
    });
    
    // Resolve the final GET fetch explicitly inside act
    await act(async () => {
      finalJsonResolve({ data: mockCommands });
      await Promise.resolve(); // allow microtasks to flush
    });
  });

  it('shows error state when API fails', async () => {
    let getCallCount = 0;
    let finalJsonResolve: (value: any) => void;
    const finalJsonPromise = new Promise(r => finalJsonResolve = r);
    
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Mock Error' }),
        });
      }
      getCallCount++;
      if (getCallCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: mockCommands }) });
      }
      return Promise.resolve({ ok: true, json: () => finalJsonPromise });
    });

    render(<CommandPanel connectors={mockConnectors} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dispatch Command' })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: 'Dispatch Command' });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/Mock Error/)).toBeInTheDocument();
    });
    
    // Resolve the final GET fetch explicitly inside act
    await act(async () => {
      finalJsonResolve({ data: mockCommands });
      await Promise.resolve(); // allow microtasks to flush
    });
  });

  it('renders empty state correctly', async () => {
    (global.fetch as jest.Mock).mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    render(<CommandPanel connectors={mockConnectors} />);
    
    await waitFor(() => {
      expect(screen.getByText('No commands have been issued for this connector.')).toBeInTheDocument();
    });
  });
});
