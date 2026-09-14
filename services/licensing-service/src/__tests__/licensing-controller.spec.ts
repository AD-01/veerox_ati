import { Test, TestingModule } from '@nestjs/testing';
import { LicensingController } from '../interfaces/rest/licensing.controller';
import { PrismaService } from '@veerox/database';
import { LicenseService } from '../application/services/license.service';
import { LicenseValidationService } from '../application/services/license-validation.service';
import { PrismaLicenseRepository } from '../infrastructure/repositories/prisma-license.repository';
import { Ed25519CryptoService } from '../infrastructure/crypto/ed25519-crypto.service';
import { PrismaAuditRepository } from '../infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository } from '../infrastructure/repositories/prisma-outbox.repository';
import { BillingEventConsumer } from '../infrastructure/billing-integration/billing-event.consumer';
import { randomUUID } from 'crypto';

jest.setTimeout(120000);

describe('LicensingController Integration Tests (S-24 Phase 01)', () => {
  let controller: LicensingController;
  let prisma: PrismaService;
  let licenseService: LicenseService;

  let orgId: string;
  let workspaceId: string;
  let productId: string;
  let userId: string;
  let licenseId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LicensingController],
      providers: [
        PrismaService,
        LicenseService,
        LicenseValidationService,
        Ed25519CryptoService,
        BillingEventConsumer,
        PrismaLicenseRepository,
        PrismaAuditRepository,
        PrismaOutboxRepository,
        { provide: 'ILicenseRepository', useClass: PrismaLicenseRepository },
        { provide: 'ICryptoService', useClass: Ed25519CryptoService },
        { provide: 'IAuditRepository', useClass: PrismaAuditRepository },
        { provide: 'IOutboxRepository', useClass: PrismaOutboxRepository },
      ],
    }).compile();

    await moduleRef.init();

    controller = moduleRef.get<LicensingController>(LicensingController);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    licenseService = moduleRef.get<LicenseService>(LicenseService);

    const user = await prisma.user.create({
      data: {
        email: `trader-lic-${randomUUID()}@veerox.com`,
        username: `user-lic-${randomUUID()}`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    userId = user.id;

    const org = await prisma.organization.create({
      data: {
        name: `Licensing Org ${randomUUID().substring(0, 8)}`,
        slug: `lic-org-${randomUUID()}`,
        ownerUserId: user.id,
      },
    });
    orgId = org.id;

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Licensing Test Workspace',
      },
    });
    workspaceId = workspace.id;

    const product = await prisma.marketplaceProduct.create({
      data: {
        organizationId: org.id,
        name: 'Test Licensing Product',
        productType: 'EA',
        pricingModel: 'ONE_TIME',
        price: 299.00,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    licenseId = await licenseService.issueLicense({
      organizationId: org.id,
      workspaceId: workspace.id,
      productId: product.id,
    });
    await licenseService.activateLicense(licenseId, org.id, workspace.id);
  });

  afterAll(async () => {
    try {
      if (workspaceId) await prisma.license.deleteMany({ where: { workspaceId } }).catch(() => {});
      if (productId) await prisma.marketplaceProduct.deleteMany({ where: { id: productId } }).catch(() => {});
      if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } }).catch(() => {});
      if (orgId) await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      if (userId) await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    } catch {
      // Cleanup best effort
    }
  });

  it('1. should retrieve workspace licenses via GET /workspaces/:workspaceId/licenses', async () => {
    const res = await controller.getWorkspaceLicenses(workspaceId, orgId);

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.some(l => l.id === licenseId)).toBe(true);
  });

  it('2. should retrieve license by id via GET /licenses/:id', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.getLicenseById(req, licenseId);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(licenseId);
    expect(res.data.status).toBe('ACTIVE');
    expect(res.data.licenseKey).toBeDefined();
  });

  it('3. should validate active license via POST /validate', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.validateLicense(req, {
      productId,
    });

    expect(res.success).toBe(true);
    expect(res.data.valid).toBe(true);
    expect(res.data.status).toBe('ACTIVE');
    expect(res.data.licenseKey).toBeDefined();
  });

  it('4. should suspend license via POST /licenses/:id/suspend', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.suspendLicense(req, licenseId, {
      reason: 'Audit check',
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('suspended successfully');

    const valRes = await controller.validateLicense(req, {
      productId,
    });
    expect(valRes.data.valid).toBe(false);
    expect(valRes.data.status).toBe('SUSPENDED');
  });

  it('5. should reactivate license via POST /licenses/:id/reactivate', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.reactivateLicense(req, licenseId, {});

    expect(res.success).toBe(true);

    const valRes = await controller.validateLicense(req, {
      productId,
    });
    expect(valRes.data.valid).toBe(true);
    expect(valRes.data.status).toBe('ACTIVE');
  });

  it('6. should revoke license via POST /licenses/:id/revoke', async () => {
    const req = { workspaceId, organizationId: orgId };
    const res = await controller.revokeLicense(req, licenseId, {
      reason: 'Contract breach',
    });

    expect(res.success).toBe(true);

    const valRes = await controller.validateLicense(req, {
      productId,
    });
    expect(valRes.data.valid).toBe(false);
    expect(valRes.data.status).toBe('REVOKED');
  });
});
