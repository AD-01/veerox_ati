import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

export class GetWorkspaceLicenseQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly productId: string,
    public readonly organizationId: string
  ) {}
}

export interface WorkspaceLicenseResult {
  licenseId: string;
  productId: string;
  status: string;
  licenseKey: string;
  issuedAt: Date;
  expiresAt: Date | null;
  subscriptionId: string | null;
}

@QueryHandler(GetWorkspaceLicenseQuery)
export class GetWorkspaceLicenseHandler implements IQueryHandler<GetWorkspaceLicenseQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspaceLicenseQuery): Promise<WorkspaceLicenseResult | null> {
    const license = await this.prisma.license.findUnique({
      where: {
        workspaceId_productId: {
          workspaceId: query.workspaceId,
          productId: query.productId
        }
      }
    });

    if (!license) return null;

    // Tenant isolation enforcement
    if (license.organizationId !== query.organizationId) {
      return null; // Fail closed — do not leak cross-tenant data
    }

    return {
      licenseId: license.id,
      productId: license.productId,
      status: license.status,
      licenseKey: license.licenseKey,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      subscriptionId: license.subscriptionId
    };
  }
}
