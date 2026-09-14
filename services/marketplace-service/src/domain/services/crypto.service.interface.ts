export interface LicensePayload {
  licenseId: string;
  organizationId: string;
  workspaceId: string;
  productId: string;
  subscriptionId: string | null;
  issuedAt: Date;
  expiresAt: Date | null;
  version: number;
}

export interface ICryptoService {
  signLicense(payload: LicensePayload): Promise<string>;
  verifyLicense(payload: LicensePayload, signature: string): Promise<boolean>;
}
