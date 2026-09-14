import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

export class GetExecutionOrdersQuery implements IQuery {
  constructor(
    public readonly workspaceId?: string,
    public readonly accountId?: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}

@QueryHandler(GetExecutionOrdersQuery)
export class GetExecutionOrdersHandler implements IQueryHandler<GetExecutionOrdersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetExecutionOrdersQuery) {
    const where: any = {};
    if (query.workspaceId) {
      where.workspaceId = query.workspaceId;
    }
    if (query.accountId) {
      where.accountId = query.accountId;
    }

    const orders = await this.prisma.executionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });

    return orders.map((order: any) => ({
      id: order.id,
      workspaceId: order.workspaceId,
      organizationId: order.organizationId,
      accountId: order.accountId,
      symbolId: order.symbolId,
      decisionId: order.decisionId,
      correlationId: order.correlationId,
      orderType: order.orderType,
      side: order.side,
      status: order.status,
      size: Number(order.size),
      requestedPrice: order.requestedPrice ? Number(order.requestedPrice) : null,
      executedPrice: order.executedPrice ? Number(order.executedPrice) : null,
      executedSize: Number(order.executedSize),
      remainingSize: Number(order.remainingSize),
      stopLoss: order.stopLoss ? Number(order.stopLoss) : null,
      takeProfit: order.takeProfit ? Number(order.takeProfit) : null,
      brokerOrderId: order.brokerOrderId,
      brokerTicketId: order.brokerTicketId,
      failureReason: order.failureReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
    }));
  }
}
