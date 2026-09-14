import * as net from 'net';
import { EventEmitter } from 'events';

export class TcpBridge extends EventEmitter {
  private server: net.Server;
  private client: net.Socket | null = null;
  
  constructor(private readonly port: number = 1337) {
    super();
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });
  }

  public start(): void {
    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[TcpBridge] MT5 Bridge listening on 127.0.0.1:${this.port}`);
    });
  }

  public stop(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.server.close();
  }

  private handleConnection(socket: net.Socket): void {
    console.log(`[TcpBridge] MT5 Terminal connected from ${socket.remoteAddress}:${socket.remotePort}`);
    
    // Only allow one MT5 client at a time for this agent instance
    if (this.client) {
      console.warn(`[TcpBridge] Rejecting duplicate MT5 connection`);
      socket.write(JSON.stringify({ error: 'AGENT_BUSY' }) + '\n');
      socket.destroy();
      return;
    }
    
    this.client = socket;
    
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');
      
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);
        
        if (line) {
          this.processMessage(line);
        }
      }
    });

    socket.on('close', () => {
      console.log(`[TcpBridge] MT5 Terminal disconnected`);
      this.client = null;
      this.emit('mt5_disconnect');
    });

    socket.on('error', (err) => {
      console.error(`[TcpBridge] Socket error:`, err.message);
      // close will be called automatically
    });
    
    this.emit('mt5_connect');
  }

  private processMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      
      // Basic validation
      if (!parsed.type) {
        throw new Error('Missing type in MT5 message');
      }

      this.emit('mt5_message', parsed);
    } catch (err) {
      console.error(`[TcpBridge] Malformed message from MT5:`, err);
      if (this.client) {
        this.client.write(JSON.stringify({ error: 'MALFORMED_MESSAGE' }) + '\n');
      }
    }
  }

  public sendToMT5(payload: object, cb?: () => void): boolean {
    if (this.client) {
      try {
        const data = JSON.stringify(payload) + '\n';
        const result = this.client.write(data, 'utf-8', cb);
        if (result && cb) {
          // If write returns true, the data was flushed to the kernel buffer immediately.
          // In Node.js, the callback might still be called, or we can just call it immediately.
          // Wait, Node.js guarantees the callback is called once the data is flushed, 
          // even if it returns true. It's safer to rely entirely on the callback.
          // We will just let the callback execute naturally.
        }
        return true;
      } catch (err) {
        console.error(`[TcpBridge] Error sending to MT5:`, err);
        return false;
      }
    } else {
      console.warn(`[TcpBridge] Cannot send to MT5, not connected.`);
      return false;
    }
  }
}
