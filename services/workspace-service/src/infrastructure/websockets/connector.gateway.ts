/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { CommandBus } from '@nestjs/cqrs';
import * as crypto from 'crypto';

interface ConnectedAgent {
  socket: WebSocket;
  connectorId: string;
  agentId: string;
  tradingAccountId: string;
  workspaceId: string;
  organizationId: string;
  status: 'CONNECTED' | 'AUTHENTICATED' | 'DEGRADED';
  lastHeartbeatAt: number;
}

@Injectable()
@WebSocketGateway({ path: '/ws/agent' })
export class ConnectorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConnectorGateway.name);
  
  // Store connected agents
  private readonly connectedAgents = new Map<string, ConnectedAgent>();
  
  // Temporary storage for nonces before auth
  private readonly pendingAuth = new Map<string, { nonce: string; timestamp: number; connectorId: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: CommandBus,
  ) {
    // Start heartbeat monitor
    setInterval(() => this.checkStaleSockets(), 5000);
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    this.logger.log(`New Agent connected`);
    // Wait for HELLO message
  }

  async handleDisconnect(client: WebSocket) {
    this.logger.log(`Agent disconnected`);
    let disconnectedConnectorId: string | undefined;
    for (const [connectorId, agent] of this.connectedAgents.entries()) {
      if (agent.socket === client) {
        disconnectedConnectorId = connectorId;
        this.connectedAgents.delete(connectorId);
        break;
      }
    }
    
    if (disconnectedConnectorId) {
      // Record audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'AGENT_DISCONNECTED',
          actorId: 'SYSTEM',
          targetEntityId: disconnectedConnectorId,
          targetEntityType: 'Connector',
          organizationId: 'SYSTEM', // Note: we'd ideally have orgId here
          workspaceId: 'SYSTEM',
          reason: 'WebSocket connection closed',
        },
      });
    }
  }

  @SubscribeMessage('HELLO')
  async handleHello(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const { agentId, protocolVersion } = data;
    if (!agentId || !protocolVersion) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_COMMAND', message: 'Missing agentId or protocolVersion' }));
      client.close();
      return;
    }

    const connector = await this.prisma.connector.findUnique({
      where: { id: agentId },
    });

    if (!connector) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Unknown agentId' }));
      client.close();
      return;
    }

    // Generate cryptographic nonce and timestamp
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    
    this.pendingAuth.set(agentId, { nonce, timestamp, connectorId: connector.id });

    // Send AUTH_CHALLENGE
    client.send(JSON.stringify({
      type: 'AUTH_CHALLENGE',
      timestamp,
      nonce,
    }));
  }

  @SubscribeMessage('AUTH_RESPONSE')
  async handleAuthResponse(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const { agentId, signature, tradingAccountId } = data;
    
    const pending = this.pendingAuth.get(agentId);
    if (!pending) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'No pending auth' }));
      client.close();
      return;
    }

    const connector = await this.prisma.connector.findUnique({
      where: { id: agentId },
      include: { credentials: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!connector || connector.credentials.length === 0) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Invalid connector credentials' }));
      client.close();
      return;
    }
    
    // Cryptographic validation (Track A)
    const credential = connector.credentials[0];
    const secretHashString = credential.secretHash;
    let agentSecret: string;
    let boundAccountId: string | undefined;
    
    try {
      if (secretHashString.startsWith('aes:')) {
        const parts = secretHashString.split(':');
        // parts[0] = aes, parts[1] = iv, parts[2] = encrypted, parts[3] = authTag, parts[4] = tradingAccountId (optional)
        if (parts.length === 5) {
          boundAccountId = parts[4];
        }
        const iv = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const authTag = Buffer.from(parts[3], 'hex');
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_byte_secret_key_mock_12';
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
        decipher.setAuthTag(authTag);
        agentSecret = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      } else {
        // Legacy fallback (should not happen for new agents)
        throw new Error('Legacy credentials unsupported');
      }
    } catch (e) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Credential decryption failed' }));
      client.close();
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', agentSecret)
      .update(`${pending.nonce}${pending.timestamp}${agentId}`)
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      await this.prisma.auditLog.create({
        data: {
          action: 'AUTH_FAILED',
          actorId: agentId,
          targetEntityId: connector.id,
          targetEntityType: 'Connector',
          organizationId: connector.organizationId,
          workspaceId: connector.workspaceId,
          reason: 'Invalid HMAC signature',
        },
      });
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Invalid signature' }));
      client.close();
      return;
    }

    // Trading Account Verification (Track B)
    if (!tradingAccountId) {
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Missing tradingAccountId' }));
      client.close();
      return;
    }

    const account = await this.prisma.tradingAccount.findUnique({
      where: { id: tradingAccountId },
    });

    if (!account || account.connectorId !== connector.id || account.organizationId !== connector.organizationId || account.workspaceId !== connector.workspaceId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'TRADING_ACCOUNT_AUTH_REJECTED',
          actorId: agentId,
          targetEntityId: connector.id,
          targetEntityType: 'Connector',
          organizationId: connector.organizationId,
          workspaceId: connector.workspaceId,
          reason: `Agent attempted to bind invalid trading account ${tradingAccountId}`,
        },
      });
      client.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED_ACCOUNT', message: 'Unauthorized trading account' }));
      client.close();
      return;
    }

    // Enforce 1 Agent -> 1 Trading Account (Track 3)
    if (boundAccountId && boundAccountId !== tradingAccountId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'TRADING_ACCOUNT_AUTH_REJECTED',
          actorId: agentId,
          targetEntityId: connector.id,
          targetEntityType: 'Connector',
          organizationId: connector.organizationId,
          workspaceId: connector.workspaceId,
          reason: `Agent is permanently bound to account ${boundAccountId} but attempted to use ${tradingAccountId}`,
        },
      });
      client.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED_ACCOUNT', message: 'Identity bound to different account' }));
      client.close();
      return;
    }

    // If this is the first authentication, permanently lock the agent to this trading account
    if (!boundAccountId) {
      const newSecretHash = `${secretHashString}:${tradingAccountId}`;
      await this.prisma.connectorCredential.update({
        where: { id: credential.id },
        data: { secretHash: newSecretHash },
      });
    }

    // Register authenticated agent
    this.connectedAgents.set(connector.id, {
      socket: client,
      connectorId: connector.id,
      agentId,
      tradingAccountId,
      workspaceId: connector.workspaceId,
      organizationId: connector.organizationId,
      status: 'AUTHENTICATED',
      lastHeartbeatAt: Date.now(),
    });
    
    this.pendingAuth.delete(agentId);

    await this.prisma.auditLog.create({
      data: {
        action: 'AUTH_SUCCESS',
        actorId: agentId,
        targetEntityId: connector.id,
        targetEntityType: 'Connector',
        organizationId: connector.organizationId,
        workspaceId: connector.workspaceId,
        reason: 'WebSocket authenticated',
      },
    });

    client.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
  }

  @SubscribeMessage('PROTOCOL_NEGOTIATION')
  async handleProtocolNegotiation(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const agent = this.findAgentBySocket(client);
    if (!agent || agent.status !== 'AUTHENTICATED') {
      return; // Ignore if not authenticated
    }

    const { supportedProtocolVersions } = data;
    if (!supportedProtocolVersions?.includes('1.0')) {
      client.send(JSON.stringify({ type: 'PROTOCOL_REJECTED', reason: 'Unsupported version' }));
      client.close();
      
      await this.prisma.auditLog.create({
        data: {
          action: 'PROTOCOL_REJECTED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: 'Unsupported protocol version',
        },
      });
      return;
    }

    agent.status = 'CONNECTED';

    await this.prisma.auditLog.create({
      data: {
        action: 'PROTOCOL_NEGOTIATION',
        actorId: agent.agentId,
        targetEntityId: agent.connectorId,
        targetEntityType: 'Connector',
        organizationId: agent.organizationId,
        workspaceId: agent.workspaceId,
        reason: 'Protocol 1.0 accepted',
      },
    });

    client.send(JSON.stringify({
      type: 'PROTOCOL_ACCEPTED',
      version: '1.0',
      capabilities: ['TRADE_EXECUTE', 'CLOSE', 'MODIFY', 'RECONCILE', 'RECOVERY'],
    }));
  }

  @SubscribeMessage('HEARTBEAT')
  handleHeartbeat(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const agent = this.findAgentBySocket(client);
    if (!agent) return;
    
    agent.lastHeartbeatAt = Date.now();
    if (agent.status === 'DEGRADED') {
      agent.status = 'CONNECTED'; // Recovered
    }

    client.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
  }

  // Lock for concurrent recovery
  private readonly recoveringAgents = new Set<string>();

  @SubscribeMessage('RECOVERY_REQUEST')
  async handleRecoveryRequest(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const agent = this.findAgentBySocket(client);
    if (!agent || agent.status !== 'CONNECTED') return;

    // Reject explicitly requested accountId that does not match bound identity
    if (data.accountId && data.accountId !== agent.tradingAccountId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'TRADING_ACCOUNT_AUTH_REJECTED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: `Agent requested recovery for unauthorized account ${data.accountId}. Mismatch between bound account and payload.`,
        },
      });
      client.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Unauthorized recovery account' }));
      client.close();
      return;
    }

    if (this.recoveringAgents.has(agent.agentId)) {
      this.logger.warn(`Agent ${agent.agentId} requested recovery but is already recovering.`);
      return; // Ignore duplicate concurrent requests
    }

    this.recoveringAgents.add(agent.agentId);

    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'RECOVERY_REQUESTED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: `Recovery requested from sequence ${data.lastSequence}`,
        },
      });

      const lastSequence = typeof data.lastSequence === 'number' ? data.lastSequence : 0;

      const missingCommands = await this.prisma.connectorCommand.findMany({
        where: {
          connectorId: agent.connectorId,
          accountSequence: { gt: lastSequence },
        },
        orderBy: { createdAt: 'asc' },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'RECOVERY_STARTED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: `Recovering ${missingCommands.length} commands`,
        },
      });

      // Send the state snapshot of sequences
      client.send(JSON.stringify({ type: 'RECOVERY_STATE', sequences: missingCommands.map(c => c.accountSequence) }));

      // Replay commands deterministically
      for (const command of missingCommands) {
        const payload = JSON.parse(command.payloadJson);
        const envelope = {
          type: 'COMMAND',
          messageId: command.id,
          commandId: command.id,
          commandType: command.commandType,
          workspaceId: agent.workspaceId,
          accountSequence: (command as any).accountSequence,
          expiresAt: command.expiresAt, // Replay TTL check
          payload,
        };

        client.send(JSON.stringify(envelope));
        
        await this.prisma.auditLog.create({
          data: {
            action: 'RECOVERY_COMMAND_REPLAYED',
            actorId: agent.agentId,
            targetEntityId: agent.connectorId,
            targetEntityType: 'Connector',
            organizationId: agent.organizationId,
            workspaceId: agent.workspaceId,
            reason: `Replayed command sequence ${(command as any).accountSequence}`,
          },
        });
      }

      client.send(JSON.stringify({ type: 'RECOVERY_COMPLETE' }));
      
      await this.prisma.auditLog.create({
        data: {
          action: 'RECOVERY_COMPLETED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: 'Recovery completed successfully',
        },
      });
    } catch (e: any) {
      await this.prisma.auditLog.create({
        data: {
          action: 'RECOVERY_FAILED',
          actorId: agent.agentId,
          targetEntityId: agent.connectorId,
          targetEntityType: 'Connector',
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          reason: `Recovery failed: ${e.message}`,
        },
      });
      client.send(JSON.stringify({ type: 'ERROR', code: 'RECOVERY_FAILED', message: 'Internal recovery error' }));
    } finally {
      this.recoveringAgents.delete(agent.agentId);
    }
  }

  @SubscribeMessage('TELEMETRY_REPORT')
  async handleTelemetryReport(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const agent = this.findAgentBySocket(client);
    if (!agent || agent.status !== 'CONNECTED') return;

    const payload = data.payload;
    if (!payload) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        const updatedAccount = await tx.tradingAccount.update({
          where: { id: agent.tradingAccountId },
          data: {
            balance: payload.balance ?? undefined,
            equity: payload.equity ?? undefined,
            marginUsed: payload.margin ?? undefined,
            freeMargin: payload.freeMargin ?? undefined,
            unrealizedPnl: payload.floatingProfit ?? undefined,
          }
        });

        const eventEnvelope = {
          eventId: crypto.randomUUID(),
          eventType: 'AccountStateChanged',
          timestamp: new Date().toISOString(),
          aggregateId: agent.tradingAccountId,
          organizationId: agent.organizationId,
          workspaceId: agent.workspaceId,
          payload: {
            accountId: agent.tradingAccountId,
            balance: Number(updatedAccount.balance),
            equity: Number(updatedAccount.equity),
            margin: Number(updatedAccount.marginUsed),
            freeMargin: Number(updatedAccount.freeMargin),
            floatingProfit: Number(updatedAccount.unrealizedPnl),
          }
        };

        await tx.outboxMessage.create({
          data: {
            aggregateType: 'TradingAccount',
            aggregateId: agent.tradingAccountId,
            eventType: 'AccountStateChanged',
            payload: eventEnvelope as any,
            organizationId: agent.organizationId,
            workspaceId: agent.workspaceId,
          }
        });

        // P1: Dispatch Portfolio Reconciliation on Telemetry
        if (payload.positions && Array.isArray(payload.positions)) {
          const reconEvent = {
            eventId: crypto.randomUUID(),
            eventType: 'PortfolioReconciliationRequestedEvent',
            timestamp: new Date().toISOString(),
            aggregateId: agent.tradingAccountId,
            organizationId: agent.organizationId,
            workspaceId: agent.workspaceId,
            payload: {
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
              tradingAccountId: agent.tradingAccountId,
              externalSnapshotId: crypto.randomUUID(),
              snapshotTimestamp: new Date().toISOString(),
              positions: payload.positions,
              balance: Number(updatedAccount.balance),
              equity: Number(updatedAccount.equity),
            }
          };

          await tx.outboxMessage.create({
            data: {
              aggregateType: 'PortfolioReconciliation',
              aggregateId: agent.tradingAccountId,
              eventType: 'PortfolioReconciliationRequestedEvent',
              payload: reconEvent as any,
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
            }
          });
        }
      });

      // Phase 10-C-C: Send ACK if transaction succeeded
      if (payload.executionReportId) {
        client.send(JSON.stringify({
          type: 'EXECUTION_REPORT_ACK',
          executionReportId: payload.executionReportId,
          status: 'ACKNOWLEDGED'
        }));
      }
    } catch (error) {
      this.logger.error(`Error processing TELEMETRY_REPORT: ${(error as Error).message}`);
    }
  }

  @SubscribeMessage('EXECUTION_REPORT')
  async handleExecutionReport(
    @MessageBody() data: any,
    @ConnectedSocket() client: WebSocket,
  ) {
    const agent = this.findAgentBySocket(client);
    if (!agent || agent.status !== 'CONNECTED') return;

    const payload = data;
    if (!payload.brokerTicketId && !payload.brokerOrderId) return;
    
    try {
      await this.prisma.$transaction(async (tx) => {
        let actionProcessed = false;
        if (payload.action === 'POSITION_OPENED' || payload.action === 'POSITION_MODIFIED' || payload.action === 'POSITION_CLOSED') {
          actionProcessed = true;
          let position = await tx.position.findFirst({
            where: { 
              tradingAccountId: agent.tradingAccountId,
              brokerTicketId: payload.brokerTicketId,
            } as any
          });

          if (!position && payload.action === 'POSITION_OPENED') {
            const symbol = await tx.symbol.findFirst({
              where: { brokerSymbol: payload.symbol }
            });
            if (!symbol) return; 

            position = await tx.position.create({
              data: {
                organizationId: agent.organizationId,
                workspaceId: agent.workspaceId,
                tradingAccountId: agent.tradingAccountId,
                symbolId: symbol.id,
                side: payload.side || 'BUY',
                quantity: payload.quantity || 0,
                averageEntryPrice: payload.price || 0,
                status: 'OPEN',
                brokerTicketId: payload.brokerTicketId,
                magicNumber: payload.magicNumber?.toString(),
              } as any
            });

            const eventEnvelope = {
              eventId: crypto.randomUUID(),
              eventType: 'PositionStateChanged',
              timestamp: new Date().toISOString(),
              aggregateId: position.id,
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
              payload: {
                positionId: position.id,
                tradingAccountId: agent.tradingAccountId,
                symbol: payload.symbol,
                side: position.side,
                quantity: Number(position.quantity),
                averageEntryPrice: Number(position.averageEntryPrice),
                unrealizedPnl: Number(position.unrealizedPnl),
                status: position.status,
                brokerTicketId: (position as any).brokerTicketId,
                magicNumber: (position as any).magicNumber,
              }
            };

            await tx.outboxMessage.create({
              data: {
                aggregateType: 'Position',
                aggregateId: position.id,
                eventType: 'PositionStateChanged',
                payload: eventEnvelope as any,
                organizationId: agent.organizationId,
                workspaceId: agent.workspaceId,
                idempotencyKey: `pos_open_${position.id}_${payload.brokerTicketId}`,
              }
            });
          } else if (position && payload.action === 'POSITION_MODIFIED') {
            position = await tx.position.update({
              where: { id: position.id },
              data: {
                quantity: payload.quantity ?? position.quantity,
                unrealizedPnl: payload.unrealizedPnl ?? position.unrealizedPnl,
                version: { increment: 1 }
              }
            });

            const eventEnvelope = {
              eventId: crypto.randomUUID(),
              eventType: 'PositionStateChanged',
              timestamp: new Date().toISOString(),
              aggregateId: position.id,
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
              payload: {
                positionId: position.id,
                tradingAccountId: agent.tradingAccountId,
                symbol: payload.symbol || '',
                side: position.side,
                quantity: Number(position.quantity),
                averageEntryPrice: Number(position.averageEntryPrice),
                unrealizedPnl: Number(position.unrealizedPnl),
                status: position.status,
                brokerTicketId: (position as any).brokerTicketId,
                magicNumber: (position as any).magicNumber,
              }
            };

            await tx.outboxMessage.create({
              data: {
                aggregateType: 'Position',
                aggregateId: position.id,
                eventType: 'PositionStateChanged',
                payload: eventEnvelope as any,
                organizationId: agent.organizationId,
                workspaceId: agent.workspaceId,
              }
            });
          } else if (position && payload.action === 'POSITION_CLOSED') {
             position = await tx.position.update({
              where: { id: position.id },
              data: {
                status: 'CLOSED',
                realizedPnl: payload.realizedPnl ?? position.realizedPnl,
                closedAt: new Date(),
                version: { increment: 1 }
              }
            });

            const eventEnvelope = {
              eventId: crypto.randomUUID(),
              eventType: 'PositionClosed',
              timestamp: new Date().toISOString(),
              aggregateId: position.id,
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
              payload: {
                positionId: position.id,
                tradingAccountId: agent.tradingAccountId,
                realizedPnl: Number(position.realizedPnl),
                closedAt: position.closedAt!.toISOString(),
              }
            };

            await tx.outboxMessage.create({
              data: {
                aggregateType: 'Position',
                aggregateId: position.id,
                eventType: 'PositionClosed',
                payload: eventEnvelope as any,
                organizationId: agent.organizationId,
                workspaceId: agent.workspaceId,
                idempotencyKey: `pos_close_${position.id}_${payload.brokerTicketId}`,
              }
            });
          }
        } else if (payload.action === 'ORDER_PLACED' || payload.action === 'ORDER_FILLED' || payload.action === 'ORDER_CANCELED' || payload.action === 'ORDER_REJECTED' || payload.action === 'RECONCILIATION_REQUIRED') {
           actionProcessed = true;
           let order = await tx.executionOrder.findFirst({
             where: {
               accountId: agent.tradingAccountId,
               brokerOrderId: payload.brokerOrderId,
             } as any
           });
           
           // P0: Cross-tenant isolation fix
           if (!order && payload.clientExecutionId) {
             order = await tx.executionOrder.findFirst({
               where: { 
                 id: payload.clientExecutionId,
                 accountId: agent.tradingAccountId,
                 workspaceId: agent.workspaceId,
                 organizationId: agent.organizationId
               }
             });
           }

           if (!order && payload.brokerOrderId) {
             order = await tx.executionOrder.findFirst({
               where: { 
                 brokerOrderId: payload.brokerOrderId,
                 accountId: agent.tradingAccountId,
                 workspaceId: agent.workspaceId,
                 organizationId: agent.organizationId
               } as any
             });
           }

           if (order) {
              const statusMap: Record<string, string> = {
                'ORDER_FILLED': 'FILLED',
                'ORDER_CANCELED': 'CANCELED',
                'ORDER_REJECTED': 'REJECTED',
                'ORDER_PLACED': 'DISPATCHED',
                'RECONCILIATION_REQUIRED': 'AWAITING_RECONCILIATION'
              };
              let newStatus = statusMap[payload.action] || order.status;
              
              if (order.status === 'FILLED') {
                newStatus = 'FILLED'; // FILLED is final authoritative state
              } else if (order.status === 'PARTIALLY_FILLED' && (newStatus === 'DISPATCHED' || newStatus === 'AWAITING_RECONCILIATION')) {
                newStatus = 'PARTIALLY_FILLED'; // Cannot un-fill
              } else if (['REJECTED', 'CANCELED', 'FAILED', 'EXPIRED'].includes(order.status) && (newStatus === 'DISPATCHED' || newStatus === 'AWAITING_RECONCILIATION')) {
                newStatus = order.status; // Cannot un-terminate
              }
              
              let newExecutedSize = payload.executedSize !== undefined ? Number(payload.executedSize) : Number((order as any).executedSize);
              if (newExecutedSize < Number((order as any).executedSize)) {
                newExecutedSize = Number((order as any).executedSize); // P0: Protect from late regression
              }
              const newRemainingSize = payload.remainingSize !== undefined ? Number(payload.remainingSize) : Number((order as any).remainingSize);
              const executedPrice = payload.executedPrice ? Number(payload.executedPrice) : Number(order.executedPrice);
              const realizedPnl = payload.realizedPnl ? Number(payload.realizedPnl) : undefined;

              if (order.status !== newStatus || newExecutedSize !== Number((order as any).executedSize) || payload.brokerOrderId !== undefined || payload.brokerTicketId !== undefined) {
                order = await tx.executionOrder.update({
                  where: { id: order.id },
                  data: {
                    status: newStatus,
                    brokerOrderId: payload.brokerOrderId ?? (order as any).brokerOrderId,
                    brokerTicketId: payload.brokerTicketId ?? (order as any).brokerTicketId,
                    executedSize: newExecutedSize,
                    remainingSize: newRemainingSize,
                    executedPrice: executedPrice,
                    failureReason: payload.failureReason ?? order.failureReason,
                  } as any
                });

                const eventEnvelope = {
                  eventId: crypto.randomUUID(),
                  eventType: 'OrderStateChanged',
                  timestamp: new Date().toISOString(),
                  aggregateId: order.id,
                  organizationId: agent.organizationId,
                  workspaceId: agent.workspaceId,
                  payload: {
                    orderId: order.id,
                    tradingAccountId: agent.tradingAccountId,
                    orderType: order.orderType,
                    side: order.side,
                    status: order.status,
                    size: Number(order.size),
                    executedSize: Number((order as any).executedSize),
                    remainingSize: Number((order as any).remainingSize),
                    executedPrice: order.executedPrice ? Number(order.executedPrice) : undefined,
                    brokerOrderId: (order as any).brokerOrderId,
                    failureReason: order.failureReason,
                  }
                };

                // P0: Deterministic Idempotency Key & P2 Concurrency Isolation
                const idempotencyKey = `exec_${order.id}_${newStatus}_${newExecutedSize}_${newRemainingSize}`;

                try {
                  await tx.outboxMessage.create({
                    data: {
                      aggregateType: 'ExecutionOrder',
                      aggregateId: order.id,
                      eventType: 'OrderStateChanged',
                      payload: eventEnvelope as any,
                      organizationId: agent.organizationId,
                      workspaceId: agent.workspaceId,
                      idempotencyKey
                    }
                  });
                } catch (error: any) {
                  if (error.code === 'P2002') {
                    this.logger.warn(`Idempotency duplicate detected for ${idempotencyKey}. Dropping safely.`);
                    return;
                  }
                  throw error;
                }
              }
           }

           // Terminal state resolution for ConnectorCommand
           if (payload.commandId) {
             const terminalStatuses = ['ORDER_FILLED', 'ORDER_CANCELED', 'ORDER_REJECTED'];
             const terminalOrderStatuses = ['FILLED', 'CANCELED', 'REJECTED', 'FAILED', 'EXPIRED'];
             
             if (terminalStatuses.includes(payload.action) || (order && terminalOrderStatuses.includes(order.status))) {
               await tx.connectorCommand.updateMany({
                 where: { id: payload.commandId, status: { notIn: ['COMPLETED', 'FAILED', 'EXPIRED'] } },
                 data: { status: 'COMPLETED', processedAt: new Date() }
               });
             }
           }
        }
        
        if (!actionProcessed) {
           throw new Error(`Unrecognized or missing payload.action: ${payload.action}`);
        }
      });

      // Phase 10-C-C/D: Send ACK if transaction succeeded (including P2002 idempotency catch)
      if (payload.executionReportId) {
        client.send(JSON.stringify({
          type: 'EXECUTION_REPORT_ACK',
          executionReportId: payload.executionReportId,
          status: 'ACKNOWLEDGED'
        }));
      }
    } catch (error) {
      this.logger.error(`Error processing EXECUTION_REPORT: ${(error as Error).message}`);
    }
  }

  public pushCommand(connectorId: string, command: any) {
    const agent = this.connectedAgents.get(connectorId);
    if (agent && agent.status === 'CONNECTED') {
      agent.socket.send(JSON.stringify(command));
    }
  }

  private findAgentBySocket(socket: WebSocket): ConnectedAgent | undefined {
    for (const agent of this.connectedAgents.values()) {
      if (agent.socket === socket) return agent;
    }
    return undefined;
  }

  private async checkStaleSockets() {
    const now = Date.now();
    for (const [connectorId, agent] of this.connectedAgents.entries()) {
      const diff = now - agent.lastHeartbeatAt;
      if (diff > 30000) {
        agent.socket.close();
        this.connectedAgents.delete(connectorId);
        
        await this.prisma.auditLog.create({
          data: {
            action: 'AGENT_DISCONNECTED',
            actorId: agent.agentId,
            targetEntityId: agent.connectorId,
            targetEntityType: 'Connector',
            organizationId: agent.organizationId,
            workspaceId: agent.workspaceId,
            reason: 'Heartbeat timeout (30s)',
          },
        });
      } else if (diff > 15000 && agent.status === 'CONNECTED') {
        agent.status = 'DEGRADED';
        await this.prisma.auditLog.create({
          data: {
            action: 'AGENT_DEGRADED',
            actorId: agent.agentId,
            targetEntityId: agent.connectorId,
            targetEntityType: 'Connector',
            organizationId: agent.organizationId,
            workspaceId: agent.workspaceId,
            reason: 'Heartbeat degraded (15s)',
          },
        });
      }
    }
  }
}
