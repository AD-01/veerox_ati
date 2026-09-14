import { WebSocketServer } from 'ws';
import { WebSocketClientTransport } from '../transport/websocket-transport';

describe('WebSocketClientTransport Integration', () => {
  let wss: WebSocketServer;
  let port: number;

  beforeAll((done) => {
    wss = new WebSocketServer({ port: 0 }, () => {
      const address = wss.address();
      if (typeof address === 'object' && address !== null) {
        port = address.port;
      }
      done();
    });
  });

  afterAll((done) => {
    wss.close(done);
  });

  it('should throw if TLS is required but wss:// is not provided', async () => {
    const transport = new WebSocketClientTransport(`ws://127.0.0.1:${port}`, true);
    await expect(transport.connect()).rejects.toThrow('TLS required');
  });

  it('should connect successfully if TLS requirement is disabled (for testing)', async () => {
    const transport = new WebSocketClientTransport(`ws://127.0.0.1:${port}`, false);
    await transport.connect();
    transport.disconnect();
  });

  it('should send and receive messages', (done) => {
    const transport = new WebSocketClientTransport(`ws://127.0.0.1:${port}`, false);
    
    wss.once('connection', (ws) => {
      ws.on('message', (msg) => {
        expect(msg.toString()).toBe('PING');
        ws.send('PONG');
      });
    });

    transport.onMessage((msg) => {
      expect(msg).toBe('PONG');
      transport.disconnect();
      done();
    });

    transport.connect().then(() => {
      transport.send('PING');
    });
  });

  it('should trigger reconnect logic on drop', (done) => {
    const transport = new WebSocketClientTransport(`ws://127.0.0.1:${port}`, false);
    
    let connections = 0;
    wss.on('connection', (ws) => {
      connections++;
      if (connections === 1) {
        // Drop it immediately
        setTimeout(() => ws.close(), 10);
      } else if (connections === 2) {
        // Reconnected!
        transport.disconnect();
        done();
      }
    });

    transport.connect();
  });
});
