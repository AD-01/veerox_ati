import * as net from 'net';
import { TcpBridge } from '../mt5-bridge/tcp-bridge';

describe('TcpBridge Integration', () => {
  let bridge: TcpBridge;
  const PORT = 1338; // Use 1338 to avoid conflicts

  beforeAll((done) => {
    bridge = new TcpBridge(PORT);
    bridge.start();
    // small delay to let server bind
    setTimeout(done, 50);
  });

  afterAll(() => {
    bridge.stop();
  });

  it('should accept connection and parse JSON messages', (done) => {
    const client = new net.Socket();
    
    bridge.once('mt5_connect', () => {
      // Send a valid JSON payload
      client.write(JSON.stringify({ type: 'MT5_TELEMETRY', balance: 1000 }) + '\n');
    });

    bridge.once('mt5_message', (msg) => {
      expect(msg.type).toBe('MT5_TELEMETRY');
      expect(msg.balance).toBe(1000);
      client.destroy();
      done();
    });

    client.connect(PORT, '127.0.0.1');
  });

  it('should reject duplicate connections', (done) => {
    const client1 = new net.Socket();
    const client2 = new net.Socket();

    let client2Data = '';

    client1.connect(PORT, '127.0.0.1', () => {
      // Once client1 connects, try client2
      client2.connect(PORT, '127.0.0.1');
    });

    client2.on('data', (data) => {
      client2Data += data.toString();
    });

    client2.on('close', () => {
      expect(client2Data).toContain('AGENT_BUSY');
      
      // Wait for server to register client1 disconnect
      bridge.once('mt5_disconnect', () => {
        done();
      });
      client1.destroy();
    });
  });

  it('should handle malformed JSON gracefully', (done) => {
    const client = new net.Socket();
    let response = '';

    client.connect(PORT, '127.0.0.1', () => {
      client.write('INVALID_JSON_HERE\n');
    });

    client.on('data', (data) => {
      response += data.toString();
      if (response.includes('MALFORMED_MESSAGE')) {
        bridge.once('mt5_disconnect', () => {
          done();
        });
        client.destroy();
      }
    });
  });
});
