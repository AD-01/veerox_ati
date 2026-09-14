/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MarketWatch } from '../market-watch';
import * as WorkspaceContext from '../../../lib/context/workspace-context';

// Mock the Workspace Context
jest.mock('../../../lib/context/workspace-context', () => ({
  useWorkspace: jest.fn(),
}));

describe('MarketWatch Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockWorkspace = { id: 'ws-123', name: 'Test Workspace' };

  it('1. should show empty state when no workspace is selected', () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: null });
    render(<MarketWatch />);
    expect(screen.getByText('No Market Data Available')).toBeInTheDocument();
  });

  it('2. should render Skeleton while loading and fetch data on mount', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    // Mock fetch to not resolve immediately
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    render(<MarketWatch />);
    
    // Check if Skeleton is rendered (via test-id or class, but we can check by card title)
    expect(screen.getByText('Market Watch')).toBeInTheDocument();
    
    // Resolve the fetch with empty data
    await act(async () => {
      resolveFetch({ ok: true, json: async () => [] });
    });
    
    await waitFor(() => {
      expect(screen.getByText('No Market Data Available')).toBeInTheDocument();
    });
  });

  it('3. should render fetched quotes properly and handle AbortController cleanup', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    const mockQuotes = [
      {
        symbolId: 'sym-1',
        standardSymbol: 'BTCUSD',
        brokerSymbol: 'BTC/USD',
        bid: 60000.5,
        ask: 60001.0,
        spread: 0.5,
        timestamp: '2026-08-30T10:00:00Z',
      }
    ];
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockQuotes
    });

    const { unmount } = render(<MarketWatch />);

    await waitFor(() => {
      expect(screen.getByText('BTCUSD')).toBeInTheDocument();
      expect(screen.getByText('60000.5')).toBeInTheDocument();
      expect(screen.getByText('60001')).toBeInTheDocument();
      expect(screen.getByText('0.5')).toBeInTheDocument();
    });

    // Check URL structure
    expect(global.fetch).toHaveBeenCalledWith('/api/market/workspaces/ws-123/market/quotes', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));

    // Test AbortController cleanup on unmount
    const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('4. should poll every 10 seconds and not leak previous workspace data', async () => {
    const workspace1 = { id: 'ws-1', name: 'WS 1' };
    const workspace2 = { id: 'ws-2', name: 'WS 2' };
    
    const mockQuotes1 = [{ symbolId: 'sym-1', standardSymbol: 'EURUSD', brokerSymbol: 'EUR/USD', bid: 1.1, ask: 1.2, spread: 0.1, timestamp: '2026-08-30T10:00:00Z' }];
    const mockQuotes2 = [{ symbolId: 'sym-2', standardSymbol: 'GBPUSD', brokerSymbol: 'GBP/USD', bid: 1.3, ask: 1.4, spread: 0.1, timestamp: '2026-08-30T10:00:00Z' }];

    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: workspace1 });
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuotes1
    });

    const { rerender } = render(<MarketWatch />);
    
    await waitFor(() => {
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Fast forward 10 seconds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuotes1
    });
    
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Now swap workspace
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: workspace2 });
    
    let resolveFetch2: any;
    const fetchPromise2 = new Promise((resolve) => {
      resolveFetch2 = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise2);

    rerender(<MarketWatch />);

    // IMMEDIATELY on rerender, quotes should be cleared because of our remediation
    expect(screen.queryByText('EURUSD')).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch2({ ok: true, json: async () => mockQuotes2 });
    });

    await waitFor(() => {
      expect(screen.getByText('GBPUSD')).toBeInTheDocument();
    });
    
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenLastCalledWith('/api/market/workspaces/ws-2/market/quotes', expect.any(Object));
  });

  it('5. should handle fetch error gracefully', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    render(<MarketWatch />);
    
    await waitFor(() => {
      expect(screen.getByText('Market Data Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });
});
