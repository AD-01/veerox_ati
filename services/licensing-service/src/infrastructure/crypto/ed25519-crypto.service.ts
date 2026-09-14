import { Injectable } from '@nestjs/common';
import { ICryptoService, LicensePayload } from '../../domain/services/crypto.service.interface';
import * as crypto from 'crypto';

@Injectable()
export class Ed25519CryptoService implements ICryptoService {
  private readonly privateKey: crypto.KeyObject;
  private readonly publicKey: crypto.KeyObject;

  constructor() {
    // In production, this would be injected from a secure KMS or environment variable
    // For testing and demonstration, if keys are not provided, we generate them.
    const privEnv = process.env.LICENSE_PRIVATE_KEY;
    const pubEnv = process.env.LICENSE_PUBLIC_KEY;

    if (privEnv && pubEnv) {
      this.privateKey = crypto.createPrivateKey({
        key: Buffer.from(privEnv, 'base64'),
        format: 'der',
        type: 'pkcs8'
      });
      this.publicKey = crypto.createPublicKey({
        key: Buffer.from(pubEnv, 'base64'),
        format: 'der',
        type: 'spki'
      });
    } else {
      // Dynamic generation for local dev/tests
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
      this.privateKey = privateKey;
      this.publicKey = publicKey;
    }
  }

  private serializePayload(payload: LicensePayload): Buffer {
    // Deterministic serialization is crucial for signature verification
    const jsonStr = JSON.stringify({
      licenseId: payload.licenseId,
      organizationId: payload.organizationId,
      workspaceId: payload.workspaceId,
      productId: payload.productId,
      subscriptionId: payload.subscriptionId,
      issuedAt: payload.issuedAt.toISOString(),
      expiresAt: payload.expiresAt ? payload.expiresAt.toISOString() : null,
      version: payload.version
    });
    return Buffer.from(jsonStr, 'utf-8');
  }

  async signLicense(payload: LicensePayload): Promise<string> {
    const data = this.serializePayload(payload);
    const signature = crypto.sign(null, data, this.privateKey);
    return signature.toString('base64');
  }

  async verifyLicense(payload: LicensePayload, signature: string): Promise<boolean> {
    try {
      const data = this.serializePayload(payload);
      const signatureBuffer = Buffer.from(signature, 'base64');
      return crypto.verify(null, data, this.publicKey, signatureBuffer);
    } catch (e) {
      return false;
    }
  }
}
