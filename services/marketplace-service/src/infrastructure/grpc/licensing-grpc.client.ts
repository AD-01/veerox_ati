import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';

@Injectable()
export class LicensingGrpcClient {
  private readonly logger = new Logger(LicensingGrpcClient.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkWorkspaceHasActiveLicense(workspaceId: string, productId: string): Promise<boolean> {
    this.logger.log(`Mocking gRPC call to LicensingService to check license for workspace ${workspaceId} on product ${productId}`);
    
    // In a real microservices architecture, this would be a gRPC call.
    // For Phase 04, since they share the database, we can do a direct DB check 
    // to simulate the "LicensingService" response for now to unblock testing.
    const license = await this.prisma.license.findUnique({
      where: {
        workspaceId_productId: {
          workspaceId,
          productId
        }
      }
    });

    return license !== null && license.status === 'ACTIVE';
  }
}
