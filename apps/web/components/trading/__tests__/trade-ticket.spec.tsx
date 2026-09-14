import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TradeTicket } from '../trade-ticket';

// Mock workspace context
jest.mock('../../../lib/context/workspace-context', () => ({
  useWorkspace: () => ({
    currentOrganization: { id: 'org-1' },
    currentWorkspace: { id: 'ws-1' }
  })
}));

// Mock realtime hook
let mockLastEvent: any = null;
jest.mock('../../../lib/hooks/useTradingRealtime', () => ({
  useTradingRealtime: () => ({
    lastEvent: mockLastEvent,
    isConnected: true,
    error: null
  })
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234'
  }
});

describe('TradeTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastEvent = null;
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/connectors/trading-accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'acc-1', accountName: 'Test Account', brokerName: 'TestBroker', tradingEnabled: true }
          ])
        });
      }
      if (url.includes('/api/market/workspaces')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { symbolId: 'sym-1', standardSymbol: 'EURUSD', bid: 1.1, ask: 1.1001 }
          ])
        });
      }
      if (url.includes('/api/execution')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders and fetches accounts and symbols', async () => {
    render(<TradeTicket />);
    
    expect(screen.getByText('Trade Ticket')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Test Account/)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/EURUSD/)).toBeInTheDocument();
    });
  });

  it('validates required fields before submission', async () => {
    render(<TradeTicket />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Test Account/)).toBeInTheDocument();
    });
    
    // Volume is empty by default. Submit should fail or button disabled.
    const submitBtn = screen.getByRole('button', { name: /Submit Trade/i });
    expect(submitBtn).toBeDisabled();
    
    // Fill volume with invalid negative number
    const volInput = screen.getByLabelText(/Volume/i);
    fireEvent.change(volInput, { target: { value: '-1' } });
    
    // Form enables since volume is filled
    expect(submitBtn).not.toBeDisabled();
    
    fireEvent.submit(screen.getByRole('button', { name: /Submit Trade/i }).closest('form')!);
    
    expect(await screen.findByText(/Volume must be a positive number/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/execution'), expect.any(Object));
  });

  it('submits a valid trade and transitions to PENDING_EXECUTION', async () => {
    render(<TradeTicket />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Test Account/)).toBeInTheDocument();
    });
    
    const volInput = screen.getByLabelText(/Volume/i);
    fireEvent.change(volInput, { target: { value: '1.5' } });
    
    const submitBtn = screen.getByRole('button', { name: /Submit Trade/i });
    fireEvent.submit(screen.getByRole('button', { name: /Submit Trade/i }).closest('form')!);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/execution/workspaces/ws-1/accounts/acc-1/trade',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"requestedSize":1.5')
        })
      );
    });
    
    expect(await screen.findByText(/Pending Execution.../i)).toBeInTheDocument();
  });

  it('handles 403 Forbidden correctly', async () => {
    // Need to set account/symbol internally by mocking data
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/connectors/trading-accounts')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'acc-1', tradingEnabled: true }]) });
      }
      if (url.includes('/api/market/workspaces')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ symbolId: 'sym-1' }]) });
      }
      if (url.includes('/api/execution')) {
        return Promise.resolve({ ok: false, status: 403 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<TradeTicket />);
    
    // Wait until account data is loaded and the form is enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BUY/i })).not.toBeDisabled();
    });
    
    const volInput = screen.getByLabelText(/Volume/i);
    fireEvent.change(volInput, { target: { value: '1.5' } });
    
    fireEvent.submit(screen.getByRole('button', { name: /Submit Trade/i }).closest('form')!);
    
    expect(await screen.findByText(/Permission denied/i)).toBeInTheDocument();
  });
});
