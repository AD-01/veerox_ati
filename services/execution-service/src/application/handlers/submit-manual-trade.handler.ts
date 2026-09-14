import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { SubmitManualTradeCommand } from '../commands/submit-manual-trade.command';
import { ExecutionOrder } from '../../domain/aggregates/execution-order.aggregate';
import { v5 as uuidv5 } from 'uuid';
import { PrismaService } from '@veerox/database';
import { OutboxService } from '@veerox/shared';
import { RiskAssessmentDto } from '@veerox/contracts';

const EXECUTION_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

@CommandHandler(SubmitManualTradeCommand)
export class SubmitManualTradeHandler implements ICommandHandler<SubmitManualTradeCommand> {
  private readonly logger = new Logger(SubmitManualTradeHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async execute(command: SubmitManualTradeCommand): Promise<void> {
    const orderId = uuidv5(command.clientExecutionId, EXECUTION_NAMESPACE);

    // 1. Idempotency fast-path
    const existingOrder = await this.prisma.executionOrder.findUnique({
      where: { id: orderId }
    });
    if (existingOrder) {
      this.logger.log(`ExecutionOrder ${orderId} already exists for clientExecutionId ${command.clientExecutionId}`);
      return;
    }

    // 2. Map trade direction for risk
    const mappedDirection = command.tradeDirection === 'BUY' ? 'LONG' : 'SHORT';

    // 2.5 Market Price Validation (Slippage)
    let priceRejectionReason: string | null = null;
    if (command.orderType === 'MARKET' && command.requestedPrice && command.maxDeviation !== null && command.maxDeviation !== undefined) {
      const latestTick = await this.prisma.tick.findFirst({
        where: { symbolId: command.symbolId },
        orderBy: { timestamp: 'desc' },
        include: { symbol: true },
      });

      if (!latestTick) {
        priceRejectionReason = 'No market data available to validate slippage.';
      } else {
        const tickTime = latestTick.timestamp.getTime();
        const now = Date.now();
        const age = now - tickTime;

        if (age < 0) {
          priceRejectionReason = 'FUTURE_MARKET_DATA: Tick timestamp is in the future.';
        } else if (age > 5000) {
          priceRejectionReason = 'STALE_MARKET_DATA: Market data is older than 5000ms threshold.';
        } else {
          const maxDev = Number(command.maxDeviation);
          const reqPrice = Number(command.requestedPrice);
          
          // maxDeviation bounds validation
          const maxAllowedDev = latestTick.symbol ? Number(latestTick.symbol.tickSize) * 1000 : reqPrice * 0.05;
          if (maxDev < 0 || maxDev > maxAllowedDev) {
             priceRejectionReason = `INVALID_DEVIATION: maxDeviation ${maxDev} is invalid or exceeds absolute limit ${maxAllowedDev}`;
          } else {
            if (command.tradeDirection === 'BUY') {
              const currentAsk = latestTick.ask.toNumber();
              if (currentAsk > reqPrice + maxDev) {
                priceRejectionReason = `PRICE_TOLERANCE_EXCEEDED: Ask price ${currentAsk} exceeds requested ${reqPrice} + max deviation ${maxDev}`;
              }
            } else {
              const currentBid = latestTick.bid.toNumber();
              if (currentBid < reqPrice - maxDev) {
                priceRejectionReason = `PRICE_TOLERANCE_EXCEEDED: Bid price ${currentBid} is below requested ${reqPrice} - max deviation ${maxDev}`;
              }
            }
          }
        }
      }
    }

    const riskUrl = process.env.RISK_SERVICE_URL || 'http://localhost:3005';
    const evaluateUrl = `${riskUrl}/api/v1/risk/evaluate?workspaceId=${command.workspaceId}`;
    
    let riskResult: RiskAssessmentDto | null = null;
    let isApproved = false;
    let finalRejectionReason = priceRejectionReason;

    if (!priceRejectionReason) {
      try {
        // 3. Synchronous Risk Evaluation via REST
        const res = await fetch(evaluateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': command.authToken,
          },
          body: JSON.stringify({
            accountId: command.accountId,
            symbolId: command.symbolId,
            tradeDirection: mappedDirection,
            requestedSize: command.requestedSize,
            correlationId: command.clientExecutionId,
            stopLoss: command.stopLoss,
            takeProfit: command.takeProfit,
          }),
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new ForbiddenException('Insufficient permissions or invalid token for risk evaluation');
          }
          throw new Error(`Risk Service returned ${res.status}`);
        }

        riskResult = (await res.json()) as RiskAssessmentDto;
        isApproved = riskResult.decisionOutcome === 'ALLOW' || riskResult.decisionOutcome === 'APPROVED';
        if (!isApproved) {
          finalRejectionReason = `Risk evaluation rejected: Risk Score ${riskResult.riskScore}`;
        }
      } catch (err: unknown) {
        this.logger.error(`Failed to reach RiskService: ${(err as Error).message}`);
        throw new BadRequestException('Could not synchronously evaluate risk. Trade rejected.');
      }
    }

    // 4. Construct aggregate
    const executionOrder = this.publisher.mergeObjectContext(
      new ExecutionOrder(
        orderId,
        command.workspaceId,
        command.organizationId,
        command.accountId,
        command.symbolId,
        null, // No decisionId for manual trades
        command.clientExecutionId,
        command.orderType,
        command.tradeDirection,
        command.requestedSize,
        command.requestedPrice || null,
        command.stopLoss,
        command.takeProfit,
      ),
    );

    if (isApproved && !finalRejectionReason) {
      executionOrder.create();
    } else {
      // Initialize as pending then immediately reject so it emits proper state changes
      executionOrder.create();
      executionOrder.reject(finalRejectionReason || 'Trade rejected');
    }

    // 5. Transactional Persistence & Outbox Event Dispatch
    try {
      await this.prisma.$transaction(async (tx) => {
        await (tx.executionOrder.create as any)({
          data: {
            id: orderId,
            workspaceId: command.workspaceId,
            organizationId: command.organizationId,
            accountId: command.accountId,
            symbolId: command.symbolId,
            decisionId: null,
            correlationId: command.clientExecutionId,
            orderType: command.orderType,
            side: command.tradeDirection,
            size: command.requestedSize,
            remainingSize: command.requestedSize,
            stopLoss: command.stopLoss,
            takeProfit: command.takeProfit,
            status: executionOrder.getStatus(),
            failureReason: executionOrder.getFailureReason(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: (isApproved && !finalRejectionReason) ? 'MANUAL_EXECUTION_ORDER_CREATED' : 'MANUAL_EXECUTION_ORDER_REJECTED',
            actorId: command.actorId,
            targetEntityId: orderId,
            targetEntityType: 'ExecutionOrder',
            newState: executionOrder.getStatus(),
            correlationId: command.clientExecutionId,
            organizationId: command.organizationId,
            workspaceId: command.workspaceId,
            reason: (isApproved && !finalRejectionReason) ? 'Manual Trade Approved' : (finalRejectionReason || 'Trade rejected'),
          },
        });

        await this.outboxService.saveEvents(tx, 'ExecutionOrder', executionOrder.id, executionOrder);
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as Error & { code?: string };
        if (err.code === 'P2002') {
          // Handled idempotency race condition gracefully
          this.logger.log(`ExecutionOrder for correlation ${command.clientExecutionId} already created during transaction.`);
          return;
        }
      }
      throw error;
    }
  }
}
