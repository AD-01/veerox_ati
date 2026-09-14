import { Controller, Get, Post, Body, Param, Query, Headers, Req, HttpCode, HttpStatus, NotFoundException, BadRequestException, UseGuards } from '@nestjs/common';
import { WorkspaceScopeGuard, WorkspaceReadAccess, WorkspaceManageAccess, OrganizationManageAccess } from '@veerox/shared';
import { PrismaService } from '@veerox/database';
import { LicenseService } from '../../application/services/license.service';
import { LicenseValidationService, LicenseValidationResult } from '../../application/services/license-validation.service';

export interface SuspendLicenseDto {
  reason: string;
}

export interface RevokeLicenseDto {
  reason: string;
}

export interface ReactivateLicenseDto {}

export interface ValidateLicenseDto {
  licenseId?: string;
  productId: string;
  payload?: any;
  signature?: string;
}

@Controller('api/v1/licensing')
export class LicensingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
    private readonly validationService: LicenseValidationService,
  ) {}

  @Get('workspaces/:workspaceId/licenses')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceLicenses(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const where: any = { workspaceId: req.workspaceId, organizationId: req.organizationId };

    const licenses = await this.prisma.license.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: licenses,
    };
  }

  @Get('workspaces/:workspaceId/licenses/:id')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getLicenseById(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean; data: any }> {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License ${id} not found`);
    }

    // Tenant isolation: verify ownership
    if (license.organizationId !== req.organizationId || license.workspaceId !== req.workspaceId) {
      throw new NotFoundException(`License ${id} not found`);
    }

    return {
      success: true,
      data: license,
    };
  }

  @Post('workspaces/:workspaceId/validate')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  @HttpCode(HttpStatus.OK)
  async validateLicense(
    @Req() req: any,
    @Body() body: ValidateLicenseDto,
  ): Promise<{ success: boolean; data: any }> {
    if (!body.productId) {
      throw new BadRequestException('productId is required');
    }

    // Direct DB validation check
    const license = await this.prisma.license.findUnique({
      where: {
        workspaceId_productId: {
          workspaceId: req.workspaceId,
          productId: body.productId,
        },
      },
    });

    if (!license) {
      return {
        success: true,
        data: {
          valid: false,
          status: 'NOT_FOUND',
          error: 'No license found for this workspace and product',
        },
      };
    }

    // Check expiration
    const isExpired = license.expiresAt ? new Date() >= license.expiresAt : false;
    const effectiveStatus = isExpired ? 'EXPIRED' : license.status;
    const isValid = effectiveStatus === 'ACTIVE';

    // If signature payload is provided, also perform full cryptographic validation
    let cryptoResult: LicenseValidationResult | undefined;
    if (body.licenseId && req.organizationId && body.payload && body.signature) {
      cryptoResult = await this.validationService.validateLicense(
        body.licenseId,
        req.organizationId,
        req.workspaceId,
        body.productId,
        body.payload,
        body.signature,
      );
    }

    return {
      success: true,
      data: {
        valid: isValid,
        status: effectiveStatus,
        licenseId: license.id,
        licenseKey: license.licenseKey,
        expiresAt: license.expiresAt,
        issuedAt: license.issuedAt,
        cryptoResult,
      },
    };
  }

  @Post('workspaces/:workspaceId/licenses/:id/suspend')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceManageAccess()
  @HttpCode(HttpStatus.OK)
  async suspendLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SuspendLicenseDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!body.reason) {
      throw new BadRequestException('reason is required');
    }

    try {
      await this.licenseService.suspendLicense(id, req.organizationId, req.workspaceId, body.reason);
      return {
        success: true,
        message: `License ${id} suspended successfully`,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to suspend license');
    }
  }

  @Post('organizations/:organizationId/workspaces/:workspaceId/licenses/:id/revoke')
  @UseGuards(WorkspaceScopeGuard)
  @OrganizationManageAccess()
  @HttpCode(HttpStatus.OK)
  async revokeLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: RevokeLicenseDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!body.reason) {
      throw new BadRequestException('reason is required');
    }

    try {
      await this.licenseService.revokeLicense(id, req.organizationId, req.workspaceId, body.reason);
      return {
        success: true,
        message: `License ${id} revoked successfully`,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to revoke license');
    }
  }

  @Post('organizations/:organizationId/workspaces/:workspaceId/licenses/:id/reactivate')
  @UseGuards(WorkspaceScopeGuard)
  @OrganizationManageAccess()
  @HttpCode(HttpStatus.OK)
  async reactivateLicense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ReactivateLicenseDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.licenseService.reactivateLicense(id, req.organizationId, req.workspaceId);
      return {
        success: true,
        message: `License ${id} reactivated successfully`,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to reactivate license');
    }
  }
}
