import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

export class GetWorkspacePurchasesQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string
  ) {}
}

export interface WorkspacePurchaseResult {
  subscriptionId: string;
  productId: string;
  status: string;
  billingPeriod: string;
  nextBillingDate: Date | null;
  createdAt: Date;
}

@QueryHandler(GetWorkspacePurchasesQuery)
export class GetWorkspacePurchasesHandler implements IQueryHandler<GetWorkspacePurchasesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspacePurchasesQuery): Promise<WorkspacePurchaseResult[]> {
    const subscriptions = await this.prisma.productSubscription.findMany({
      where: {
        workspaceId: query.workspaceId,
        organizationId: query.organizationId
      },
      orderBy: { createdAt: 'desc' }
    });

    return subscriptions.map(sub => ({
      subscriptionId: sub.id,
      productId: sub.productId,
      status: sub.status,
      billingPeriod: sub.billingPeriod,
      nextBillingDate: sub.nextBillingDate,
      createdAt: sub.createdAt
    }));
  }
}
