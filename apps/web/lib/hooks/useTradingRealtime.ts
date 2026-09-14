import { useEffect, useState } from 'react';
import { EventEnvelope } from '@veerox/contracts';

interface UseTradingRealtimeProps {
  organizationId?: string | null;
  workspaceId?: string | null;
  enabled?: boolean;
}

interface UseTradingRealtimeResult {
  lastEvent: EventEnvelope | null;
  isConnected: boolean;
  error: string | null;
}

type Listener = (event: EventEnvelope | null, connected: boolean, error: string | null) => void;

class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private es: EventSource | null = null;
  private listeners: Set<Listener> = new Set();
  
  private currentUrl: string | null = null;
  private isConnected: boolean = false;
  private currentError: string | null = null;
  private lastEvent: EventEnvelope | null = null;
  
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  public static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  public subscribe(url: string, listener: Listener): () => void {
    this.listeners.add(listener);
    
    // Catch up new listener with current state
    listener(this.lastEvent, this.isConnected, this.currentError);

    if (this.currentUrl !== url) {
      this.connect(url);
    } else if (!this.es && !this.reconnectTimeout) {
      this.connect(url);
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect(url: string) {
    this.disconnect();
    this.currentUrl = url;

    this.es = new EventSource(url);

    this.es.onopen = () => {
      this.isConnected = true;
      this.currentError = null;
      this.reconnectAttempts = 0;
      this.notify();
    };

    this.es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as EventEnvelope;
        this.lastEvent = data;
        this.notify();
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    this.es.onerror = () => {
      this.isConnected = false;
      if (this.es) {
        this.es.close();
        this.es = null;
      }
      
      const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts += 1;
      
      this.currentError = `Connection lost. Reconnecting in ${timeout / 1000}s...`;
      this.notify();
      
      this.reconnectTimeout = setTimeout(() => {
        if (this.currentUrl && this.listeners.size > 0) {
          this.connect(this.currentUrl);
        }
      }, timeout);
    };
  }

  private notify() {
    this.listeners.forEach(listener => {
      listener(this.lastEvent, this.isConnected, this.currentError);
    });
  }

  private disconnect() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.currentUrl = null;
    this.isConnected = false;
    this.currentError = null;
  }
}

export function useTradingRealtime({
  organizationId,
  workspaceId,
  enabled = true,
}: UseTradingRealtimeProps): UseTradingRealtimeResult {
  const [state, setState] = useState<UseTradingRealtimeResult>({
    lastEvent: null,
    isConnected: false,
    error: null,
  });

  useEffect(() => {
    if (!organizationId || !workspaceId || !enabled) {
      return;
    }

    const url = `/api/workspaces/${organizationId}/${workspaceId}/realtime/stream`;
    const manager = RealtimeManager.getInstance();
    
    const unsubscribe = manager.subscribe(url, (lastEvent, isConnected, error) => {
      setState({ lastEvent, isConnected, error });
    });

    return unsubscribe;
  }, [organizationId, workspaceId, enabled]);

  return state;
}
