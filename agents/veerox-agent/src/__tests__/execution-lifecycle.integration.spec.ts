import { AgentRuntime } from '../core/agent-runtime';
import { MockTransport } from '../transport/mock-transport';
import { TcpBridge } from '../mt5-bridge/tcp-bridge';
import { AgentState } from '../core/state-machine';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

import * as crypto from 'crypto';

describe('Execution Lifecycle Integration', () => {
  let transport: MockTransport;
  let tcpBridge: TcpBridge;
  let runtime: AgentRuntime;
  const PORT = 1340;
  
  let sentMessages: any[] = [];
  let mt5Client: net.Socket;
  let testAgentId: string;

  beforeEach(async () => {
    testAgentId = `test-agent-${crypto.randomUUID()}`;
    transport = new MockTransport();
    tcpBridge = new TcpBridge(PORT);
    sentMessages = [];
    tcpBridge.start();

    try {
      fs.unlinkSync(path.join(process.cwd(), 'data', `agent-state-${testAgentId}.json`));
      fs.unlinkSync(path.join(process.cwd(), 'data', `report-queue-${testAgentId}.json`));
    } catch (e) {}

    // Capture transport sends
    jest.spyOn(transport, 'send').mockImplementation((msg: string) => {
      sentMessages.push(JSON.parse(msg));
    });

    runtime = new AgentRuntime(
      transport,
      tcpBridge,
      testAgentId,
      'secret-key',
      'org-1',
      'workspace-1',
      'connector-1',
      'account-1'
    );

    // Bootstrap handshake
    await runtime.start();
    const challenge = { type: 'AUTH_CHALLENGE', nonce: '123', timestamp: new Date().toISOString() };
    transport.simulateBackendMessage(challenge);
    transport.simulateBackendMessage({ type: 'AUTH_SUCCESS' });
    transport.simulateBackendMessage({ type: 'PROTOCOL_ACCEPTED' });
    
    // Setup MT5 Client
    return new Promise((resolve) => {
      tcpBridge.once('mt5_connect', () => resolve(undefined));
      mt5Client = new net.Socket();
      mt5Client.connect(PORT, '127.0.0.1');
    });
  });

  afterEach((done) => {
    mt5Client.removeAllListeners();
    mt5Client.destroy();
    tcpBridge.stop();
    runtime.stop();
    try {
      fs.unlinkSync(path.join(process.cwd(), 'data', `agent-state-${testAgentId}.json`));
      fs.unlinkSync(path.join(process.cwd(), 'data', `report-queue-${testAgentId}.json`));
    } catch (e) {}
    setTimeout(done, 50); // Give socket close events time to flush
  });

  const baseCommand = {
    messageId: 'msg-1',
    commandId: 'cmd-1',
    commandType: 'TRADE_EXECUTE',
    protocolVersion: '1.0',
    agentId: 'agent-1',
    organizationId: 'org-1',
    workspaceId: 'workspace-1',
    tradingAccountId: 'account-1',
    connectorId: 'connector-1',
    accountSequence: 0,
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    payload: {
      clientExecutionId: 'client-1',
      symbol: 'EURUSD',
      side: 'BUY',
      quantity: 1.0,
      sl: 1.05,
      tp: 1.15
    }
  };

  it('A/B. Should process valid BUY/SELL and forward to MT5', (done) => {
    let buffer = '';
    mt5Client.on('data', (data) => {
      buffer += data.toString();
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);
        
        if (line) {
          console.log('Received from MT5 in Test A/B: ', line);
          const msg = JSON.parse(line);
          expect(msg.commandId).toBe('cmd-1');
          expect(msg.payload.side).toBe('BUY');
          
          // Simulate MQL5 executing and replying
          const report = {
            type: 'MT5_EXECUTION_REPORT',
            commandId: 'cmd-1',
            clientExecutionId: 'client-1',
            brokerTicketId: 'ticket-1',
            status: 'FILLED',
            symbol: 'EURUSD',
            side: 'BUY',
            executedSize: 1.0,
            executedPrice: 1.1000
          };
          mt5Client.write(JSON.stringify(report) + '\n');
        }
      }
    });

    transport.simulateBackendMessage(baseCommand);

    const checkInterval = setInterval(() => {
      try {
        const reports = sentMessages.filter(m => m.type === 'EXECUTION_REPORT');
        if (reports.length > 0) {
          clearInterval(checkInterval);
          const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
          expect(acks.length).toBeGreaterThan(0);
          expect(acks[0].status).toBe('COMMAND_ACCEPTED');
          expect(reports[0].status).toBe('FILLED');
          expect(reports[0].organizationId).toBe('org-1');
          done();
        }
      } catch (err) {
        clearInterval(checkInterval);
        done(err);
      }
    }, 10);
  });

  it('D. Should reject duplicate command', () => {
    transport.simulateBackendMessage(baseCommand);
    transport.simulateBackendMessage(baseCommand);
    
    const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
    expect(acks.length).toBe(2);
    expect(acks[0].status).toBe('COMMAND_ACCEPTED');
    expect(acks[1].status).toBe('COMMAND_ACCEPTED');
    expect(acks[1].reason).toBe('DUPLICATE_ACKNOWLEDGED');
  });

  it('F. Should reject sequence gap and trigger recovery', () => {
    transport.simulateBackendMessage({ ...baseCommand, commandId: 'cmd-f', accountSequence: 5 });
    
    const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
    expect(acks[0].status).toBe('COMMAND_REJECTED');
    expect(acks[0].reason).toBe('SEQUENCE_GAP');
    
    const recoveryReq = sentMessages.filter(m => m.type === 'RECOVERY_REQUEST');
    expect(recoveryReq.length).toBe(1);
  });

  it('G. Should reject stale sequence', () => {
    transport.simulateBackendMessage(baseCommand); // seq 0
    transport.simulateBackendMessage({ ...baseCommand, commandId: 'cmd-2', accountSequence: 0 }); // seq 0 again but diff cmd
    
    const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
    expect(acks[1].status).toBe('COMMAND_REJECTED');
    expect(acks[1].reason).toBe('STALE_COMMAND');
  });

  it('H. Should reject tenant mismatch', () => {
    transport.simulateBackendMessage({ ...baseCommand, commandId: 'cmd-h', workspaceId: 'wrong-tenant' });
    
    const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
    expect(acks[0].status).toBe('COMMAND_REJECTED');
    expect(acks[0].reason).toBe('TENANT_MISMATCH');
  });

  it('J. Should reject invalid quantity', () => {
    transport.simulateBackendMessage({ ...baseCommand, commandId: 'cmd-j', payload: { ...baseCommand.payload, quantity: -1 } });
    
    const acks = sentMessages.filter(m => m.type === 'COMMAND_ACK');
    expect(acks[0].status).toBe('COMMAND_REJECTED');
    expect(acks[0].reason).toBe('INVALID_QUANTITY');
  });

  it('M. MT5 disconnect mid-flight should not crash agent', (done) => {
    transport.simulateBackendMessage(baseCommand);
    mt5Client.destroy();
    
    setTimeout(() => {
      // Agent should still be CONNECTED (MT5 drop doesn't kill cloud link immediately unless execution fails)
      expect(runtime.getState()).toBe(AgentState.CONNECTED);
      done();
    }, 20);
  });
});
