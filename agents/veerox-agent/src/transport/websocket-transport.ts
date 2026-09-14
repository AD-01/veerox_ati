import WebSocket from 'ws';
import { ExecutionTransport } from './execution-transport';

export class WebSocketClientTransport implements ExecutionTransport {
  private ws: WebSocket | null = null;
  private messageHandler: ((message: string) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6; // Max backoff ~64s
  private isConnecting = false;
  private isIntentionalDisconnect = false;
  
  constructor(private readonly url: string, private readonly requireTls: boolean = true) {}

  public async connect(): Promise<void> {
    if (this.requireTls && !this.url.startsWith('wss://')) {
      throw new Error('TLS required: URL must use wss:// scheme');
    }
    
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.isIntentionalDisconnect = false;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0; // Reset backoff
          resolve();
        });

        this.ws.on('message', (data) => {
          if (this.messageHandler) {
            this.messageHandler(data.toString());
          }
        });

        this.ws.on('error', (err) => {
          console.error('[WebSocketClientTransport] WebSocket error:', err.message);
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(err);
          }
        });

        this.ws.on('close', () => {
          this.ws = null;
          this.isConnecting = false;
          
          if (this.disconnectHandler) {
            this.disconnectHandler();
          }

          if (!this.isIntentionalDisconnect) {
            this.scheduleReconnect();
          }
        });
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketClientTransport] Max reconnect attempts reached. Halting reconnect.');
      return;
    }
    
    const backoffMs = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectAttempts++;
    
    console.log(`[WebSocketClientTransport] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Suppress unhandled promise rejection; on('close') will trigger another scheduleReconnect()
      });
    }, backoffMs);
  }

  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public send(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      console.warn('[WebSocketClientTransport] Cannot send message, socket is not open');
    }
  }

  public onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }

  public onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }
}
