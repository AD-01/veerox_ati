import { Injectable, Inject } from '@nestjs/common';
import { ILicenseRepository } from '../../domain/repositories/license.repository.interface';
import { ICryptoService, LicensePayload } from '../../domain/services/crypto.service.interface';

export enum LicenseValidationResult {
  VALID = 'VALID',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED',
  TENANT_MISMATCH = 'TENANT_MISMATCH',
  PRODUCT_MISMATCH = 'PRODUCT_MISMATCH',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID'
}

@Injectable()
export class LicenseValidationService {
  constructor(
    @Inject('ILicenseRepository') private readonly licenseRepo: ILicenseRepository,
    @Inject('ICryptoService') private readonly cryptoService: ICryptoService
  ) {}

  async validateLicense(
    licenseId: string,
    organizationId: string,
    workspaceId: string,
    productId: string,
    providedPayload: LicensePayload,
    signature: string
  ): Promise<LicenseValidationResult> {
    // 1. Validate signature first (Fast cryptographic check, protects against tampering)
    const isSignatureValid = await this.cryptoService.verifyLicense(providedPayload, signature);
    if (!isSignatureValid) {
      return LicenseValidationResult.SIGNATURE_INVALID;
    }

    // 2. Validate tampering against what's requested
    if (providedPayload.licenseId !== licenseId || 
        providedPayload.workspaceId !== workspaceId || 
        providedPayload.organizationId !== organizationId) {
      return LicenseValidationResult.TENANT_MISMATCH;
    }

    if (providedPayload.productId !== productId) {
      return LicenseValidationResult.PRODUCT_MISMATCH;
    }

    // 3. Database lookup for current state (since keys can be valid but revoked later)
    // Note: Caching could be introduced here for ultra-fast validation
    const license = await this.licenseRepo.findById(licenseId);
    if (!license) return LicenseValidationResult.INVALID;

    // 4. Validate DB matches payload to prevent downgrade attacks (using an old valid signature for an old state)
    if (license.version !== providedPayload.version || license.licenseKey !== signature) {
      return LicenseValidationResult.SIGNATURE_INVALID; 
    }

    // 5. Evaluate state
    if (license.status === 'REVOKED') return LicenseValidationResult.REVOKED;
    if (license.status === 'SUSPENDED') return LicenseValidationResult.SUSPENDED;
    if (license.status === 'EXPIRED') return LicenseValidationResult.EXPIRED;
    
    // Evaluate if it should be expired now
    if (license.status === 'ACTIVE' && license.expiresAt && new Date() >= license.expiresAt) {
      return LicenseValidationResult.EXPIRED;
    }
    
    if (license.status !== 'ACTIVE') return LicenseValidationResult.INVALID;

    return LicenseValidationResult.VALID;
  }
}
