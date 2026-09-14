import { CommandProcessor } from '../core/command-processor';
import { CommandEnvelope } from '../core/types';

import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('CommandProcessor', () => {
  let processor: CommandProcessor;
  
  const orgId = 'org-1';
  const workspaceId = 'workspace-1';
  const connectorId = 'connector-1';
  const accountId = 'account-1';

  beforeEach(() => {
    processor = new CommandProcessor('agent-1', orgId, workspaceId, connectorId, accountId);
  });

  const baseEnvelope: CommandEnvelope = {
    messageId: 'msg-1',
    commandId: 'cmd-1',
    commandType: 'TRADE_EXECUTE',
    protocolVersion: '1.0',
    agentId: 'agent-1',
    organizationId: orgId,
    workspaceId: workspaceId,
    connectorId: connectorId,
    tradingAccountId: accountId,
    accountSequence: 0,
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    payload: { 
      clientExecutionId: 'client-exec-1',
      symbol: 'EURUSD', 
      side: 'BUY',
      quantity: 1.0 
    }
  };

  it('should process valid command sequence and increment', () => {
    const result = processor.processEnvelope(baseEnvelope);
    expect(result.isValid).toBe(true);
    expect(result.ack.status).toBe('COMMAND_ACCEPTED');
  });

  it('should reject tenant mismatch', () => {
    const maliciousEnvelope = { ...baseEnvelope, organizationId: 'malicious-org' };
    const result = processor.processEnvelope(maliciousEnvelope);
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('TENANT_MISMATCH');
    expect(result.ack.status).toBe('COMMAND_REJECTED');
  });

  it('should detect sequence gap', () => {
    // Expected is 0, we send 1
    const gapEnvelope = { ...baseEnvelope, accountSequence: 1 };
    const result = processor.processEnvelope(gapEnvelope);
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('SEQUENCE_GAP');
    expect(result.ack.status).toBe('COMMAND_REJECTED');
  });

  it('should detect duplicate command and emit idempotent ACK without executing if DISPATCHED or CONFIRMED', () => {
    // Process first time to make it known and increment expected sequence
    const firstResult = processor.processEnvelope(baseEnvelope);
    expect(firstResult.isValid).toBe(true);
    processor.markAsQueued(baseEnvelope.commandId, baseEnvelope);
    processor.markAsDispatched(baseEnvelope.commandId);
    
    // Process second time (simulate replay)
    const result = processor.processEnvelope(baseEnvelope);
    
    expect(result.isValid).toBe(false); // Prevents execution
    expect(result.error).toBeUndefined(); // It's not a hard error, just idempotent ack
    expect(result.ack.status).toBe('COMMAND_ACCEPTED'); // Agent accepts the dupe transport wise
    expect(result.ack.reason).toBe('DUPLICATE_ACKNOWLEDGED');

    processor.markAsConfirmed(baseEnvelope.commandId);
    const result2 = processor.processEnvelope(baseEnvelope);
    expect(result2.isValid).toBe(false);
  });

  it('should allow execution if command is only QUEUED (crash before dispatch)', () => {
    processor.markAsQueued(baseEnvelope.commandId, baseEnvelope);
    
    const result = processor.processEnvelope(baseEnvelope);
    expect(result.isValid).toBe(true);
  });

  it('should detect stale sequence', () => {
    // Process 0
    processor.processEnvelope(baseEnvelope);
    // Process 1
    processor.processEnvelope({ ...baseEnvelope, commandId: 'cmd-2', accountSequence: 1 });
    
    // Send 0 again but with new command ID (simulating weird replay)
    const staleEnvelope = { ...baseEnvelope, commandId: 'cmd-3', accountSequence: 0 };
    const result = processor.processEnvelope(staleEnvelope);
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('STALE_COMMAND');
    expect(result.ack.status).toBe('COMMAND_REJECTED');
  });

  describe('Financial Geometry Validation', () => {
    it('should reject quantity <= 0, NaN, or Infinity', () => {
      const invalidQuantities = [0, -1, NaN, Infinity];
      let seq = 0;
      invalidQuantities.forEach((qty) => {
        const env = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, quantity: qty } };
        const res = processor.processEnvelope(env as any);
        expect(res.isValid).toBe(false);
        expect(res.ack.reason).toBe('INVALID_QUANTITY');
      });
    });

    it('should reject invalid BUY geometry (SL >= Entry or TP <= Entry)', () => {
      // BUY: SL < Entry < TP
      const invalidBuys = [
        { price: 1.1000, sl: 1.1001, tp: 1.1050 }, // SL > Entry
        { price: 1.1000, sl: 1.1000, tp: 1.1050 }, // SL == Entry
        { price: 1.1000, sl: 1.0900, tp: 1.0950 }, // TP < Entry
        { price: 1.1000, sl: 1.0900, tp: 1.1000 }, // TP == Entry
      ];

      let seq = 0;
      invalidBuys.forEach((geom) => {
        const env = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, side: 'BUY', ...geom } };
        const res = processor.processEnvelope(env as any);
        expect(res.isValid).toBe(false);
        expect(res.ack.reason).toBe('INVALID_GEOMETRY');
      });
    });

    it('should reject invalid SELL geometry (TP >= Entry or SL <= Entry)', () => {
      // SELL: TP < Entry < SL
      const invalidSells = [
        { price: 1.1000, sl: 1.0999, tp: 1.0950 }, // SL < Entry
        { price: 1.1000, sl: 1.1000, tp: 1.0950 }, // SL == Entry
        { price: 1.1000, sl: 1.1050, tp: 1.1050 }, // TP > Entry
        { price: 1.1000, sl: 1.1050, tp: 1.1000 }, // TP == Entry
      ];

      let seq = 0;
      invalidSells.forEach((geom) => {
        const env = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, side: 'SELL', ...geom } };
        const res = processor.processEnvelope(env as any);
        expect(res.isValid).toBe(false);
        expect(res.ack.reason).toBe('INVALID_GEOMETRY');
      });
    });

    it('should reject negative, NaN, or Infinity prices/SL/TP', () => {
      const invalidValues = [-1.5, NaN, Infinity, 0];
      let seq = 0;
      invalidValues.forEach((val) => {
        const env1 = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, price: val } };
        expect(processor.processEnvelope(env1 as any).isValid).toBe(false);

        const env2 = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, price: 1.1, sl: val } };
        expect(processor.processEnvelope(env2 as any).isValid).toBe(false);

        const env3 = { ...baseEnvelope, accountSequence: seq++, payload: { ...baseEnvelope.payload, price: 1.1, tp: val } };
        expect(processor.processEnvelope(env3 as any).isValid).toBe(false);
      });
    });

    it('should accept valid BUY geometry', () => {
      const env = { ...baseEnvelope, payload: { ...baseEnvelope.payload, side: 'BUY', price: 1.1000, sl: 1.0900, tp: 1.1100 } };
      const res = processor.processEnvelope(env as any);
      expect(res.isValid).toBe(true);
    });

    it('should accept valid SELL geometry', () => {
      const env = { ...baseEnvelope, payload: { ...baseEnvelope.payload, side: 'SELL', price: 1.1000, sl: 1.1100, tp: 1.0900 } };
      const res = processor.processEnvelope(env as any);
      expect(res.isValid).toBe(true);
    });
  });
});
