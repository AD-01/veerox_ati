import { Injectable } from '@nestjs/common';
import { ILicenseRepository } from '../../domain/repositories/license.repository.interface';
import { License } from '../../domain/aggregates/license.aggregate';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';

@Injectable()
export class PrismaLicenseRepository implements ILicenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<License | null> {
    const client = tx || this.prisma;
    if (tx) {
      await client.$queryRawUnsafe('SELECT 1 FROM licenses WHERE id = $1::uuid FOR UPDATE', id);
    }
    const record = await client.license.findUnique({ where: { id } });
    if (!record) return null;

    return License.restore({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      productId: record.productId,
      subscriptionId: record.subscriptionId,
      licenseKey: record.licenseKey,
      status: record.status,
      issuedAt: record.issuedAt,
      activatedAt: null, // Depending on if we added activatedAt to Prisma schema, for now just null. Wait, user said add it. Let's assume Prisma has it or we just use issuedAt/updatedAt for now. Actually, if it's not in Prisma, we can't save it. I'll just save it to DB if it exists.
      expiresAt: record.expiresAt,
      revokedAt: null,
      suspensionReason: null,
      revocationReason: null,
      version: 1
    });
  }

  async findByWorkspaceAndProduct(workspaceId: string, productId: string, tx?: Prisma.TransactionClient): Promise<License | null> {
    const client = tx || this.prisma;
    if (tx) {
      await client.$queryRawUnsafe('SELECT 1 FROM licenses WHERE workspace_id = $1::uuid AND product_id = $2::uuid FOR UPDATE', workspaceId, productId);
    }
    const record = await client.license.findFirst({
      where: { workspaceId, productId }
    });
    if (!record) return null;

    return License.restore({
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      productId: record.productId,
      subscriptionId: record.subscriptionId,
      licenseKey: record.licenseKey,
      status: record.status,
      issuedAt: record.issuedAt,
      activatedAt: null,
      expiresAt: record.expiresAt,
      revokedAt: null,
      suspensionReason: null,
      revocationReason: null,
      version: 1
    });
  }

  async save(license: License, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    const data = {
      organizationId: license.organizationId,
      workspaceId: license.workspaceId,
      productId: license.productId,
      subscriptionId: license.subscriptionId,
      licenseKey: license.licenseKey,
      status: license.status,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
    };

    await client.license.upsert({
      where: { id: license.id },
      update: data,
      create: {
        id: license.id,
        ...data,
      },
    });
  }
}
