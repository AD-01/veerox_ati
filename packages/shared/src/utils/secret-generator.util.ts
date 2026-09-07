import * as crypto from 'crypto';

export class SecretGenerator {
  /**
   * Generates a cryptographically secure high-entropy secret.
   * Returns a 32-byte secret encoded as a base64url string.
   */
  static generateSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
