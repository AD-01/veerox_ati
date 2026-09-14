import { CommandEnvelope, CommandAck } from './types';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class CommandProcessor {
  private expectedSequence = 0; // Starts at 0 for simplicity, real impl gets from DB/local store
  private commandStates = new Map<string, { state: 'QUEUED' | 'DISPATCHED' | 'CONFIRMED', envelope?: CommandEnvelope }>();
  private readonly stateFile: string;

  constructor(
    private readonly agentId: string,
    private readonly organizationId: string,
    private readonly workspaceId: string,
    private readonly connectorId: string,
    private readonly tradingAccountId: string,
  ) {
    this.stateFile = path.resolve(process.cwd(), 'data', `agent-state-${this.agentId}.json`);
    this.loadState();
  }

  private loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const state = JSON.parse(raw);
        if (state.expectedSequence !== undefined) this.expectedSequence = state.expectedSequence;
        if (state.commandStates) {
          const entries = Object.entries(state.commandStates);
          this.commandStates = new Map(entries.map(([k, v]) => {
            if (typeof v === 'string') {
              return [k, { state: v as any }];
            }
            return [k, v as any];
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load agent state', e);
    }
  }

  private saveState() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const state = {
        expectedSequence: this.expectedSequence,
        commandStates: Object.fromEntries(this.commandStates),
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save agent state', e);
    }
  }

  public processEnvelope(envelope: CommandEnvelope, isKillSwitchActive: boolean = false): {
    ack: CommandAck;
    error?: 'SEQUENCE_GAP' | 'STALE_COMMAND' | 'KILL_SWITCH_ACTIVE' | 'TENANT_MISMATCH';
    isValid: boolean;
  } {
    // 0. Duplicate Detection (Must be very first to catch replays before sequence check fails them)
    const current = this.commandStates.get(envelope.commandId);
    const currentState = current?.state;
    if (currentState === 'QUEUED') {
      // We crashed before dispatching, so we MUST execute it this time!
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_ACCEPTED', 'DUPLICATE_ACKNOWLEDGED'),
        isValid: true,
      };
    }
    
    if (currentState === 'DISPATCHED' || currentState === 'CONFIRMED') {
      // Idempotent ACK return, but DO NOT execute.
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_ACCEPTED', 'DUPLICATE_ACKNOWLEDGED'),
        isValid: false,
      };
    }

    // 1. Sequence Enforcement (Must be before consumption to avoid permanent stalls on rejected commands)
    if (envelope.accountSequence > this.expectedSequence) {
      // Sequence Gap
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'SEQUENCE_GAP'),
        error: 'SEQUENCE_GAP',
        isValid: false,
      };
    } else if (envelope.accountSequence < this.expectedSequence) {
      // Stale Command
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'STALE_COMMAND'),
        error: 'STALE_COMMAND',
        isValid: false,
      };
    }

    // Command sequence is exactly what we expected.
    // Consume the sequence now, so even if payload is invalid, we don't stall.
    this.expectedSequence++;

    // Note: Do NOT persist command as DISPATCHED here.
    // It will be added in markAsDispatched() after a successful TCP bridge send.

    // 2. Tenant & Identity Boundary Check
    if (
      envelope.organizationId !== this.organizationId ||
      envelope.workspaceId !== this.workspaceId ||
      envelope.connectorId !== this.connectorId ||
      envelope.tradingAccountId !== this.tradingAccountId
    ) {
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'TENANT_MISMATCH'),
        error: 'TENANT_MISMATCH',
        isValid: false,
      };
    }

    if (isKillSwitchActive && ['TRADE_EXECUTE', 'MODIFY'].includes(envelope.commandType)) {
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'KILL_SWITCH_ACTIVE'),
        error: 'KILL_SWITCH_ACTIVE',
        isValid: false,
      };
    }

    // 2.1 TTL / Expiration Check
    if (envelope.expiresAt) {
      const expirationDate = new Date(envelope.expiresAt);
      if (Date.now() > expirationDate.getTime()) {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'EXPIRED'),
          error: 'STALE_COMMAND',
          isValid: false,
        };
      }
    }

    // 3. Strict Payload Validation for TRADE_EXECUTE
    if (envelope.commandType === 'TRADE_EXECUTE') {
      const payload = envelope.payload as any;
      if (!payload || !payload.clientExecutionId || !payload.symbol || !payload.side || typeof payload.quantity !== 'number') {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_PAYLOAD'),
          isValid: false,
        };
      }

      if (typeof payload.quantity !== 'number' || isNaN(payload.quantity) || !isFinite(payload.quantity) || payload.quantity <= 0) {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_QUANTITY'),
          isValid: false,
        };
      }

      if (payload.side !== 'BUY' && payload.side !== 'SELL') {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_SIDE'),
          isValid: false,
        };
      }

      // 3.1 Strict Geometry Check (if price/SL/TP are provided)
      const price = payload.price;
      const sl = payload.sl;
      const tp = payload.tp;
      
      const isInvalidNumber = (num: any) => typeof num === 'number' && (isNaN(num) || !isFinite(num) || num <= 0);

      if (price !== undefined && isInvalidNumber(price)) {
        return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
      }
      if (sl !== undefined && isInvalidNumber(sl)) {
        return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
      }
      if (tp !== undefined && isInvalidNumber(tp)) {
        return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
      }

      if (price && price > 0) {
        if (payload.side === 'BUY') {
          // BUY: SL < Entry < TP
          if (sl && sl >= price) return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
          if (tp && tp <= price) return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
        }
        if (payload.side === 'SELL') {
          // SELL: TP < Entry < SL
          if (sl && sl <= price) return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
          if (tp && tp >= price) return { ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_GEOMETRY'), isValid: false };
        }
      }
    } else if (envelope.commandType === 'CLOSE') {
      const payload = envelope.payload as any;
      if (!payload || !payload.brokerTicketId) {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_PAYLOAD'),
          isValid: false,
        };
      }
    } else if (envelope.commandType === 'MODIFY') {
      const payload = envelope.payload as any;
      if (!payload || !payload.brokerTicketId || (payload.sl === undefined && payload.tp === undefined)) {
        return {
          ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_PAYLOAD'),
          isValid: false,
        };
      }
    } else if (envelope.commandType === 'RECONCILE') {
      // Reconcile may not have a specific payload requirements
    } else if (envelope.commandType === 'HEARTBEAT' || envelope.commandType === 'RECOVERY') {
      // Known system commands
    } else {
      return {
        ack: this.createAck(envelope.commandId, 'COMMAND_REJECTED', 'INVALID_COMMAND_TYPE'),
        isValid: false,
      };
    }

    // Reaching here means all checks passed, safe to execute
    return {
      ack: this.createAck(envelope.commandId, 'COMMAND_ACCEPTED'),
      isValid: true,
    };
  }

  private createAck(commandId: string, status: CommandAck['status'], reason?: string): CommandAck {
    return {
      ackId: randomUUID(),
      commandId,
      status,
      reason,
    };
  }

  /**
   * Called before TCP bridge send attempt.
   */
  public markAsQueued(commandId: string, envelope: CommandEnvelope): void {
    if (!this.commandStates.has(commandId)) {
      this.commandStates.set(commandId, { state: 'QUEUED', envelope });
      this.saveState();
    }
  }

  /**
   * Called strictly after a successful synchronous OS-level write to the TCP socket.
   */
  public markAsDispatched(commandId: string): void {
    const current = this.commandStates.get(commandId);
    if (current && current.state !== 'DISPATCHED' && current.state !== 'CONFIRMED') {
      this.commandStates.set(commandId, { ...current, state: 'DISPATCHED' });
      this.saveState();
    }
  }

  /**
   * Called when MT5 acknowledges the execution.
   */
  public markAsConfirmed(commandId: string): void {
    const current = this.commandStates.get(commandId);
    if (current && current.state !== 'CONFIRMED') {
      this.commandStates.set(commandId, { ...current, state: 'CONFIRMED' });
      this.saveState();
    }
  }

  public getCommandStates(): Map<string, { state: 'QUEUED' | 'DISPATCHED' | 'CONFIRMED', envelope?: CommandEnvelope }> {
    return this.commandStates;
  }

  public getRecoverableCommands(): CommandEnvelope[] {
    const recoverable: CommandEnvelope[] = [];
    for (const [id, data] of this.commandStates.entries()) {
      if (data.state === 'QUEUED' && data.envelope) {
        recoverable.push(data.envelope);
      }
    }
    return recoverable;
  }
}
