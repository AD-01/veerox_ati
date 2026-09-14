import { AgentState, StateMachine } from './state-machine';
import { Authenticator } from './authenticator';
import { CommandProcessor } from './command-processor';
import { ExecutionTransport } from '../transport/execution-transport';
import { AuthChallenge, AuthResponse, Heartbeat, ProtocolNegotiation, CommandEnvelope } from './types';
import { TcpBridge } from '../mt5-bridge/tcp-bridge';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class AgentRuntime {
  private stateMachine = new StateMachine();
  private authenticator: Authenticator;
  private commandProcessor: CommandProcessor;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private periodicFlushInterval: NodeJS.Timeout | null = null;
  private missingHeartbeats = 0;
  private reportQueue: any[] = [];
  private readonly queueFile: string;

  constructor(
    private readonly transport: ExecutionTransport,
    private readonly tcpBridge: TcpBridge,
    private readonly agentId: string,
    private readonly agentSecret: string,
    private readonly organizationId: string,
    private readonly workspaceId: string,
    private readonly connectorId: string,
    private readonly tradingAccountId: string,
    private readonly protocolVersion = '1.0',
    private readonly agentVersion = '1.4.2'
  ) {
    this.authenticator = new Authenticator(agentSecret, agentId);
    this.commandProcessor = new CommandProcessor(agentId, organizationId, workspaceId, connectorId, tradingAccountId);
    this.queueFile = path.resolve(process.cwd(), 'data', `report-queue-${this.agentId}.json`);

    this.transport.onMessage(this.handleMessage.bind(this));
    this.transport.onDisconnect(this.handleDisconnect.bind(this));
    
    this.tcpBridge.on('mt5_message', this.handleMt5Message.bind(this));
    this.loadReportQueue();
  }

  private loadReportQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        this.reportQueue = JSON.parse(fs.readFileSync(this.queueFile, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load report queue', e);
    }
  }

  private saveReportQueue() {
    try {
      const MAX_QUEUE_SIZE = 5000;
      if (this.reportQueue.length > MAX_QUEUE_SIZE) {
        console.error(`[CRITICAL] Report queue exceeded ${MAX_QUEUE_SIZE}. Holding reports on disk but risk of OOM increases.`);
      }

      const dir = path.dirname(this.queueFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmpFile = `${this.queueFile}.tmp`;
      
      const fd = fs.openSync(tmpFile, 'w');
      fs.writeSync(fd, JSON.stringify(this.reportQueue, null, 2));
      fs.fdatasyncSync(fd);
      fs.closeSync(fd);
      
      fs.renameSync(tmpFile, this.queueFile);
    } catch (e) {
      console.error('Failed to save report queue', e);
    }
  }

  async start(): Promise<void> {
    this.stateMachine.transition(AgentState.CONNECTING);
    await this.transport.connect();
    
    // Begin Protocol Handshake
    this.stateMachine.transition(AgentState.AUTHENTICATING);
    this.transport.send(JSON.stringify({
      type: 'HELLO',
      agentId: this.agentId,
      protocolVersion: this.protocolVersion,
      agentVersion: this.agentVersion,
    }));
  }

  stop(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.periodicFlushInterval) clearInterval(this.periodicFlushInterval);
    this.transport.disconnect();
    this.stateMachine.transition(AgentState.DISCONNECTED);
  }

  public getState(): AgentState {
    return this.stateMachine.getState();
  }

  private handleMessage(message: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(message);
    } catch {
      return; // Drop malformed
    }

    const currentState = this.stateMachine.getState();

    if (currentState === AgentState.AUTHENTICATING && parsed.type === 'AUTH_CHALLENGE') {
      this.handleAuthChallenge(parsed as unknown as AuthChallenge);
      return;
    }

    if (currentState === AgentState.AUTHENTICATING && parsed.type === 'AUTH_SUCCESS') {
      this.stateMachine.transition(AgentState.NEGOTIATING);
      const negotiation: ProtocolNegotiation & { type: string } = {
        type: 'PROTOCOL_NEGOTIATION',
        supportedProtocolVersions: [this.protocolVersion],
        capabilities: ['TRADE_EXECUTE', 'RECONCILE']
      };
      this.transport.send(JSON.stringify(negotiation));
      return;
    }

    if (currentState === AgentState.AUTHENTICATING && parsed.type === 'AUTH_FAILURE') {
      // Force disconnect without retry
      this.stop();
      throw new Error('Authentication failed');
    }

    if (currentState === AgentState.NEGOTIATING && parsed.type === 'PROTOCOL_ACCEPTED') {
      this.stateMachine.transition(AgentState.CONNECTED);
      this.startHeartbeat();
      this.resolveAmbiguousCommands();
      this.flushReportQueue();
      return;
    }

    if (currentState === AgentState.NEGOTIATING && parsed.type === 'PROTOCOL_REJECTED') {
      this.stop();
      throw new Error('Protocol rejected');
    }

    if (parsed.type === 'HEARTBEAT_ACK') {
      this.missingHeartbeats = 0;
      if (this.stateMachine.getState() === AgentState.DEGRADED) {
        this.stateMachine.transition(AgentState.CONNECTED);
      }
      return;
    }

    // Kill Switch handling
    if (parsed.commandType === 'KILL_SWITCH') {
      (this as any).isKillSwitchActive = true;
    } else if (parsed.commandType === 'RESUME_EXECUTION') {
      (this as any).isKillSwitchActive = false;
    }

    // Handle ACKs from Gateway
    if (parsed.type === 'EXECUTION_REPORT_ACK') {
      const ackId = parsed.executionReportId as string;
      if (ackId) {
        const initialLen = this.reportQueue.length;
        this.reportQueue = this.reportQueue.filter(r => r.executionReportId !== ackId);
        if (this.reportQueue.length < initialLen) {
          console.log(`Report ${ackId} acknowledged and removed from queue.`);
          this.saveReportQueue();
        }
      }
      return;
    }

    // Financial Commands handling
    if (parsed.commandId && this.stateMachine.canProcessFinancialCommands()) {
      const envelope = parsed as unknown as CommandEnvelope;
      const result = this.commandProcessor.processEnvelope(envelope, (this as any).isKillSwitchActive || false);
      
      this.transport.send(JSON.stringify({ type: 'COMMAND_ACK', ...result.ack }));

      if (result.error === 'SEQUENCE_GAP') {
        this.stateMachine.transition(AgentState.RECOVERY_REQUIRED);
        this.transport.send(JSON.stringify({ type: 'RECOVERY_REQUEST' }));
      } else if (result.isValid && ['TRADE_EXECUTE', 'CLOSE', 'MODIFY', 'RECONCILE'].includes(envelope.commandType)) {
        // Dispatch to MT5
        this.commandProcessor.markAsQueued(envelope.commandId, envelope);
        this.tcpBridge.sendToMT5(envelope, () => {
          this.commandProcessor.markAsDispatched(envelope.commandId);
        });
      } else if (result.isValid) {
        // Safe to mark as processed for non-financial commands
        this.commandProcessor.markAsConfirmed(envelope.commandId);
      }
    } else if (parsed.commandId) {
      // Reject commands if not in CONNECTED state
      this.transport.send(JSON.stringify({
        type: 'COMMAND_ACK',
        commandId: parsed.commandId,
        status: 'COMMAND_REJECTED',
        reason: 'AGENT_NOT_READY'
      }));
    }
  }

  private handleAuthChallenge(challenge: AuthChallenge): void {
    if (!this.authenticator.verifyChallenge(challenge.timestamp)) {
      this.stop();
      throw new Error('Challenge timestamp skew too high');
    }

    const signature = this.authenticator.generateResponse(challenge.nonce, challenge.timestamp);
    const response: AuthResponse & { type: string } = {
      type: 'AUTH_RESPONSE',
      agentId: this.agentId,
      signature,
      tradingAccountId: this.tradingAccountId,
    };

    this.transport.send(JSON.stringify(response));
  }

  private handleDisconnect(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.stateMachine.getState() !== AgentState.DISCONNECTED) {
      this.stateMachine.transition(AgentState.RECONNECTING);
      // In real agent, schedule reconnect loop
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.missingHeartbeats++;
      if (this.missingHeartbeats >= 3 && this.stateMachine.getState() === AgentState.CONNECTED) {
        this.stateMachine.transition(AgentState.DEGRADED);
      }
      if (this.missingHeartbeats >= 6) {
        this.stop();
        return;
      }
      
      const hb: Heartbeat & { type: string } = {
        type: 'HEARTBEAT',
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        terminalStatus: 'CONNECTED',
        executionCapability: true
      };
      this.transport.send(JSON.stringify(hb));
    }, 5000);

    if (this.periodicFlushInterval) clearInterval(this.periodicFlushInterval);
    this.periodicFlushInterval = setInterval(() => {
      if (this.stateMachine.getState() === AgentState.CONNECTED) {
        this.flushReportQueue();
      }
    }, 10000);
  }

  private resolveAmbiguousCommands(): void {
    const states = this.commandProcessor.getCommandStates();
    
    // Recover QUEUED commands
    const recoverable = this.commandProcessor.getRecoverableCommands();
    for (const envelope of recoverable) {
      if (envelope.expiresAt && new Date(envelope.expiresAt).getTime() < Date.now()) {
        console.log(`Command ${envelope.commandId} expired while QUEUED. Rejecting.`);
        this.transport.send(JSON.stringify({
          type: 'COMMAND_ACK',
          commandId: envelope.commandId,
          status: 'COMMAND_REJECTED',
          reason: 'EXPIRED'
        }));
        this.commandProcessor.markAsConfirmed(envelope.commandId);
      } else {
        console.log(`Recovered QUEUED command ${envelope.commandId}. Re-dispatching to MT5.`);
        this.tcpBridge.sendToMT5(envelope, () => {
          this.commandProcessor.markAsDispatched(envelope.commandId);
        });
      }
    }

    for (const [commandId, data] of states.entries()) {
      if (data.state === 'DISPATCHED') {
        const report = {
          type: 'EXECUTION_REPORT',
          commandId,
          clientExecutionId: commandId,
          brokerTicketId: '0',
          brokerOrderId: '0',
          action: 'RECONCILIATION_REQUIRED',
          status: 'AWAITING_RECONCILIATION',
          reason: 'Agent crashed before broker confirmation. Check broker manually.',
          agentId: this.agentId,
          organizationId: this.organizationId,
          workspaceId: this.workspaceId,
          connectorId: this.connectorId,
          tradingAccountId: this.tradingAccountId,
          timestamp: new Date().toISOString(),
          origin: 'SYSTEM'
        };
        this.transport.send(JSON.stringify(report));
        this.commandProcessor.markAsConfirmed(commandId);
      }
    }
  }

  private flushReportQueue(): void {
    if (this.reportQueue.length === 0) return;
    console.log(`Flushing ${this.reportQueue.length} queued reports`);
    for (const report of this.reportQueue) {
      this.transport.send(JSON.stringify(report));
    }
    // We do NOT clear the report queue here. It is cleared ONLY upon EXECUTION_REPORT_ACK.
  }

  private handleMt5Message(parsed: Record<string, any>): void {
    console.log('handleMt5Message received:', parsed);
    if (this.stateMachine.getState() !== AgentState.CONNECTED) {
      console.log('Agent not connected, ignoring message');
      return; // Do not forward telemetry if not connected
    }

    if (parsed.type === 'MT5_TELEMETRY') {
      console.log('Sending TELEMETRY_REPORT');
      const telemetryReport = {
        executionReportId: crypto.randomUUID(), // Transient is fine for ephemeral telemetry
        type: 'TELEMETRY_REPORT',
        agentId: this.agentId,
        organizationId: this.organizationId,
        workspaceId: this.workspaceId,
        connectorId: this.connectorId,
        tradingAccountId: this.tradingAccountId,
        timestamp: new Date().toISOString(),
        payload: parsed
      };
      
      // S-24 Phase 10-C-D: Telemetry is NOT queued to disk to avoid execution poison.
      if (this.stateMachine.getState() === AgentState.CONNECTED) {
        this.transport.send(JSON.stringify(telemetryReport));
      }
    } else if (parsed.type === 'MT5_EXECUTION_REPORT') {
      if (parsed.commandId) {
        this.commandProcessor.markAsConfirmed(parsed.commandId);
      }
      
      let origin = 'VEEROX';
      if (parsed.magicNumber !== undefined) {
        if (parsed.magicNumber === 0) {
          origin = 'MANUAL';
        } else if (parsed.magicNumber !== 72583) { // Assume 72583 is Veerox's designated magic number
          origin = 'EXTERNAL_EA';
        }
      }

      if (origin !== 'VEEROX' && this.stateMachine.getState() === AgentState.CONNECTED) {
        this.transport.send(JSON.stringify({
          type: 'EXTERNAL_POSITION_DETECTED',
          agentId: this.agentId,
          organizationId: this.organizationId,
          workspaceId: this.workspaceId,
          connectorId: this.connectorId,
          tradingAccountId: this.tradingAccountId,
          timestamp: new Date().toISOString(),
          origin,
          payload: parsed
        }));
      }

      // S-24 Phase 10-C-D: Stable deterministic identity mapping from MT5 EA, or fallback
      const deterministicId = parsed.executionReportId || `${parsed.clientExecutionId}_${parsed.brokerTicketId || '0'}_${parsed.status}`;

      const executionReport = {
        ...parsed,
        executionReportId: deterministicId, // Ensure stable identity across retries
        origin,
        type: 'EXECUTION_REPORT',
        agentId: this.agentId,
        organizationId: this.organizationId,
        workspaceId: this.workspaceId,
        connectorId: this.connectorId,
        tradingAccountId: this.tradingAccountId,
      };
      
      console.log('Queueing and Sending EXECUTION_REPORT', executionReport);
      
      // Phase 10-C-D Durable First: Push and save before sending over network
      this.reportQueue.push(executionReport);
      this.saveReportQueue();

      if (this.stateMachine.getState() === AgentState.CONNECTED) {
        this.transport.send(JSON.stringify(executionReport));
      }
    } else {
      console.log('Message type did not match', parsed.type);
    }
  }
}
