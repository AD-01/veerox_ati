/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { StrategyStatus } from '../strategy-status';
import * as WorkspaceContext from '../../../lib/context/workspace-context';

jest.mock('../../../lib/context/workspace-context', () => ({
  useWorkspace: jest.fn(),
}));

describe('StrategyStatus Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockWorkspace = { id: 'ws-123', name: 'Test Workspace' };

  it('Test 4 & 5 - Loading state and Empty state', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    render(<StrategyStatus />);
    
    // Loading State
    expect(screen.getByText('Strategy Status')).toBeInTheDocument();
    
    await act(async () => {
      resolveFetch({ ok: true, json: async () => [] });
    });
    
    // Empty State
    await waitFor(() => {
      expect(screen.getByText('No Strategies Available')).toBeInTheDocument();
    });
  });

  it('Test 1, 2, 3 - Successful retrieval, Multiple strategies, Current strategy', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    const mockStrategies = [
      { strategyId: 's-1', name: 'Alpha Trend', status: 'ACTIVE', isCurrent: true, updatedAt: '2026-08-30T10:00:00Z' },
      { strategyId: 's-2', name: 'Beta Reversion', status: 'PAUSED', isCurrent: false, updatedAt: '2026-08-30T09:00:00Z' },
    ];
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockStrategies
    });

    render(<StrategyStatus />);

    await waitFor(() => {
      // Test 1: name, status, current indicator, updatedAt
      expect(screen.getByText('Alpha Trend')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
      expect(screen.getByText(/Updated:/)).toBeInTheDocument();

      // Test 2: Multiple strategies
      expect(screen.getByText('Beta Reversion')).toBeInTheDocument();
      expect(screen.getByText('PAUSED')).toBeInTheDocument();

      // Test 3: isCurrent true/false logic
      // Current appears only once for Alpha Trend (Badge "CURRENT")
      expect(screen.getAllByText('CURRENT').length).toBe(1);
    });
  });

  it('Test 6 - Error state', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    render(<StrategyStatus />);
    
    await waitFor(() => {
      expect(screen.getByText('Strategy Status Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('Test 7 - Workspace change', async () => {
    const ws1 = { id: 'ws-1' };
    const ws2 = { id: 'ws-2' };
    
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: ws1 });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ strategyId: 's-1', name: 'Strat A', status: 'ACTIVE', isCurrent: true, updatedAt: '2026-08-30T10:00:00Z' }]
    });

    const { rerender } = render(<StrategyStatus />);
    
    await waitFor(() => {
      expect(screen.getByText('Strat A')).toBeInTheDocument();
    });

    // Swap workspace
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: ws2 });
    
    let resolveFetch2: any;
    const fetchPromise2 = new Promise((resolve) => {
      resolveFetch2 = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise2);

    rerender(<StrategyStatus />);

    // Check loading occurs and old data is cleared
    expect(screen.queryByText('Strat A')).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch2({ ok: true, json: async () => [{ strategyId: 's-2', name: 'Strat B', status: 'ACTIVE', isCurrent: true, updatedAt: '2026-08-30T10:00:00Z' }] });
    });

    await waitFor(() => {
      expect(screen.getByText('Strat B')).toBeInTheDocument();
    });
  });

  it('Test 8 - Abort behavior', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // Never resolves

    const { unmount } = render(<StrategyStatus />);
    
    const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
    unmount();
    
    expect(signal.aborted).toBe(true);
  });

  it('Test 9 - Polling', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => []
    });

    render(<StrategyStatus />);
    
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('Test 10 & 11 - Unknown status and Invalid timestamp', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    const mockStrategies = [
      { strategyId: 's-1', name: 'Broken Strat', status: 'UNKNOWN_OR_WEIRD', isCurrent: false, updatedAt: 'Invalid Date String' },
    ];
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockStrategies
    });

    render(<StrategyStatus />);

    await waitFor(() => {
      // Test 10: Unknown status renders neutrally
      expect(screen.getByText('UNKNOWN_OR_WEIRD')).toBeInTheDocument();
      // Test 11: Invalid timestamp renders neutrally
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
      expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });
  });

  it('Test 12 - No fabricated metrics', async () => {
    (WorkspaceContext.useWorkspace as jest.Mock).mockReturnValue({ currentWorkspace: mockWorkspace });
    
    const mockStrategies = [
      { strategyId: 's-1', name: 'Alpha Trend', status: 'ACTIVE', isCurrent: true, updatedAt: '2026-08-30T10:00:00Z' },
    ];
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockStrategies
    });

    render(<StrategyStatus />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Trend')).toBeInTheDocument();
    });

    // Ensure we don't accidentally fabricate these terms
    expect(screen.queryByText(/PnL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/win rate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trade count/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/uptime/i)).not.toBeInTheDocument();
  });
});
