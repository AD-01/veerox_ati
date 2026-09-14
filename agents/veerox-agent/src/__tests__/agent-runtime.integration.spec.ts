import { AgentRuntime } from '../core/agent-runtime';
import { MockTransport } from '../transport/mock-transport';
import { AgentState } from '../core/state-machine';
import { TcpBridge } from '../mt5-bridge/tcp-bridge';

import * as fs from 'fs';
import * as path from 'path';

import * as crypto from 'crypto';

describe('AgentRuntime Integration', () => {
  let transport: MockTransport;
  let tcpBridge: TcpBridge;
  let runtime: AgentRuntime;
  let sentMessages: string[] = [];
  let testAgentId: string;

  beforeEach(() => {
    testAgentId = `test-agent-${crypto.randomUUID()}`;
    try {
      fs.unlinkSync(path.join(process.cwd(), 'data', `agent-state-${testAgentId}.json`));
      fs.unlinkSync(path.join(process.cwd(), 'data', `report-queue-${testAgentId}.json`));
    } catch (e) {}
    transport = new MockTransport();
    tcpBridge = new TcpBridge(1339); // test port
    sentMessages = [];
    
    // Capture transport sends
    jest.spyOn(transport, 'send').mockImplementation((msg: string) => {
      sentMessages.push(msg);
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
  });

  afterEach(() => {
    runtime.stop();
    try {
      fs.unlinkSync(path.join(process.cwd(), 'data', `agent-state-${testAgentId}.json`));
      fs.unlinkSync(path.join(process.cwd(), 'data', `report-queue-${testAgentId}.json`));
    } catch (e) {}
  });

  it('should perform complete handshake and process command', async () => {
    // 1. Start agent (Transitions to CONNECTING -> AUTHENTICATING, sends HELLO)
    await runtime.start();
    expect(runtime.getState()).toBe(AgentState.AUTHENTICATING);
    expect(sentMessages.length).toBe(1);
    const helloMsg = JSON.parse(sentMessages[0]);
    expect(helloMsg.type).toBe('HELLO');

    // 2. Connector sends AUTH_CHALLENGE
    transport.simulateBackendMessage({
      type: 'AUTH_CHALLENGE',
      nonce: '12345',
      timestamp: new Date().toISOString()
    });

    // Agent should send AUTH_RESPONSE
    expect(sentMessages.length).toBe(2);
    const authResponse = JSON.parse(sentMessages[1]);
    expect(authResponse.type).toBe('AUTH_RESPONSE');
    expect(authResponse.signature).toBeDefined();

    // 3. Connector sends AUTH_SUCCESS
    transport.simulateBackendMessage({ type: 'AUTH_SUCCESS' });
    
    // Agent should send PROTOCOL_NEGOTIATION and transition to NEGOTIATING
    expect(runtime.getState()).toBe(AgentState.NEGOTIATING);
    expect(sentMessages.length).toBe(3);
    expect(JSON.parse(sentMessages[2]).type).toBe('PROTOCOL_NEGOTIATION');

    // 4. Connector sends PROTOCOL_ACCEPTED
    transport.simulateBackendMessage({ type: 'PROTOCOL_ACCEPTED' });
    
    // Agent should be CONNECTED and ready for financial commands
    expect(runtime.getState()).toBe(AgentState.CONNECTED);

    // 5. Connector sends TRADE_EXECUTE
    transport.simulateBackendMessage({
      commandId: 'cmd-1',
      commandType: 'TRADE_EXECUTE',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      connectorId: 'connector-1',
      tradingAccountId: 'account-1',
      accountSequence: 0,
      timestamp: new Date().toISOString(),
      payload: {
        clientExecutionId: 'client-1',
        symbol: 'EURUSD',
        side: 'BUY',
        quantity: 1.0
      }
    });

    // Agent should reply with COMMAND_ACK
    expect(sentMessages.length).toBe(4);
    const ack = JSON.parse(sentMessages[3]);
    expect(ack.type).toBe('COMMAND_ACK');
    expect(ack.status).toBe('COMMAND_ACCEPTED');
  });

  it('should disconnect on AUTH_FAILURE', async () => {
    await runtime.start();
    expect(() => {
      transport.simulateBackendMessage({ type: 'AUTH_FAILURE' });
    }).toThrow('Authentication failed');
    
    expect(runtime.getState()).toBe(AgentState.DISCONNECTED);
  });
});
