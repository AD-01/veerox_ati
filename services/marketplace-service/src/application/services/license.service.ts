import { Injectable, Inject } from '@nestjs/common';
import { ILicenseRepository } from '../../domain/repositories/license.repository.interface';
import { ICryptoService } from '../../domain/services/crypto.service.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { IOutboxRepository } from '../ports/outbox.repository.interface';
import { PrismaService } from '@veerox/database';
import { License } from '../../domain/aggregates/license.aggregate';

@Injectable()
export class LicenseService {
  constructor(
    @Inject('ILicenseRepository') private readonly licenseRepo: ILicenseRepository,
    @Inject('ICryptoService') private readonly cryptoService: ICryptoService,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    @Inject('IOutboxRepository') private readonly outboxRepo: IOutboxRepository,
    private readonly prisma: PrismaService
  ) {}

  async issueLicense(props: {
    organizationId: string;
    workspaceId: string;
    productId: string;
    subscriptionId?: string;
  }): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Verify existence / idempotency (ONLY ONE ACTIVE LICENSE PER WORKSPACE/PRODUCT allowed in DB)
      // Prisma P2002 handles race conditions if schema has @@unique([workspaceId, productId])
      let license = await this.licenseRepo.findByWorkspaceAndProduct(props.workspaceId, props.productId);
      
      if (license) {
        if (license.status === 'ACTIVE' || license.status === 'PENDING') {
          return license.id; // Idempotent return
        } else {
          // Can reissue if revoked/expired or just create a new one. 
          // Let's create a new one, but we might hit P2002 if we don't delete the old one or if the unique constraint is broad.
          // Prisma schema says: @@unique([workspaceId, productId]) // One active license per workspace per product
          // So we must update the existing record rather than creating a new ID if it's the same unique key.
          license = License.restore({
            ...license,
            status: 'PENDING', // restart lifecycle
            issuedAt: new Date()
          });
        }
      } else {
        const id = crypto.randomUUID();
        license = License.issue({
          id,
          ...props,
          expiresAt: null
        });
      }

      try {
        await this._persistLicense(license, tx, 'LICENSE_ISSUED', props.organizationId, props.workspaceId);
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Concurrent insert won the race — return the existing license (idempotent)
          const existing = await this.licenseRepo.findByWorkspaceAndProduct(props.workspaceId, props.productId);
          if (existing) return existing.id;
        }
        throw error;
      }
      return license.id;
    });
  }

  async activateLicense(licenseId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const license = await this.licenseRepo.findById(licenseId);
      if (!license) throw new Error('License not found');
      if (license.organizationId !== organizationId || license.workspaceId !== workspaceId) throw new Error('Unauthorized');

      if (license.status === 'ACTIVE') return; // Idempotent

      const prevState = license.status;
      license.activate();

      await this._persistLicense(license, tx, 'LICENSE_ACTIVATED', organizationId, workspaceId, prevState);
    });
  }

  async revokeLicense(licenseId: string, organizationId: string, workspaceId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const license = await this.licenseRepo.findById(licenseId);
      if (!license) throw new Error('License not found');
      if (license.organizationId !== organizationId || license.workspaceId !== workspaceId) throw new Error('Unauthorized');

      if (license.status === 'REVOKED') return; // Idempotent

      const prevState = license.status;
      license.revoke(reason);

      await this._persistLicense(license, tx, 'LICENSE_REVOKED', organizationId, workspaceId, prevState);
    });
  }

  async suspendLicense(licenseId: string, organizationId: string, workspaceId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const license = await this.licenseRepo.findById(licenseId);
      if (!license) throw new Error('License not found');
      if (license.organizationId !== organizationId || license.workspaceId !== workspaceId) throw new Error('Unauthorized');

      if (license.status === 'SUSPENDED') return; // Idempotent
      if (license.status === 'REVOKED' || license.status === 'EXPIRED') return; // Can't suspend what's already dead

      const prevState = license.status;
      license.suspend(reason);

      await this._persistLicense(license, tx, 'LICENSE_SUSPENDED', organizationId, workspaceId, prevState);
    });
  }

  async reactivateLicense(licenseId: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.activateLicense(licenseId, organizationId, workspaceId);
  }

  async evaluateExpiration(licenseId: string): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      const license = await this.licenseRepo.findById(licenseId);
      if (!license) return false;

      const expired = license.evaluateExpiration(new Date());
      if (expired) {
        await this._persistLicense(license, tx, 'LICENSE_EXPIRED', license.organizationId, license.workspaceId);
        return true;
      }
      return false;
    });
  }

  async getEntitlements(licenseId: string): Promise<any> {
    const license = await this.licenseRepo.findById(licenseId);
    if (!license) throw new Error('License not found');

    const product = await this.prisma.marketplaceProduct.findUnique({ where: { id: license.productId } });
    if (!product) return {};

    // Fallback since schema does not have features json column yet
    return {
      maxAccounts: 5,
      executionEnabled: true
    };
  }

  async validateEntitlement(licenseId: string, featureKey: string): Promise<boolean> {
    const entitlements = await this.getEntitlements(licenseId);
    return !!entitlements[featureKey];
  }

  private async _persistLicense(license: License, tx: any, action: string, organizationId: string, workspaceId: string, previousState?: string) {
    const signature = await this.cryptoService.signLicense({
      licenseId: license.id,
      organizationId: license.organizationId,
      workspaceId: license.workspaceId,
      productId: license.productId,
      subscriptionId: license.subscriptionId,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      version: license.version
    });

    if (action === 'LICENSE_ISSUED') {
      license.attachCryptographicKey(signature);
    } else {
      license.updateCryptographicKey(signature);
    }

    await this.licenseRepo.save(license, tx);
    await this.outboxRepo.publishAll(license.getUncommittedEvents(), tx);
    license.commit(); // Ensure events are cleared

    await this.auditRepo.log({
      action,
      organizationId,
      workspaceId,
      targetEntityId: license.id,
      targetEntityType: 'LICENSE',
      previousState,
      newState: license.status
    }, tx);
  }
}
