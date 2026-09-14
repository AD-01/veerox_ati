import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { LicenseValidationService, LicenseValidationResult } from '../services/license-validation.service';
import { LicensePayload } from '../../domain/services/crypto.service.interface';

export class ValidateLicenseQuery {
  constructor(
    public readonly licenseId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string,
    public readonly payload: LicensePayload,
    public readonly signature: string
  ) {}
}

@QueryHandler(ValidateLicenseQuery)
export class ValidateLicenseHandler implements IQueryHandler<ValidateLicenseQuery> {
  constructor(private readonly validationService: LicenseValidationService) {}

  async execute(query: ValidateLicenseQuery): Promise<LicenseValidationResult> {
    return this.validationService.validateLicense(
      query.licenseId,
      query.organizationId,
      query.workspaceId,
      query.productId,
      query.payload,
      query.signature
    );
  }
}
