import * as crypto from 'crypto';

export class Authenticator {
  constructor(private readonly agentSecret: string, private readonly agentId: string) {}

  generateResponse(nonce: string, timestamp: string): string {
    const payload = `${nonce}${timestamp}${this.agentId}`;
    return crypto
      .createHmac('sha256', this.agentSecret)
      .update(payload)
      .digest('hex');
  }

  verifyChallenge(timestamp: string): boolean {
    const serverTime = new Date(timestamp).getTime();
    const localTime = Date.now();
    const skew = Math.abs(serverTime - localTime);
    
    // Max 5 seconds skew tolerance
    if (skew > 5000) {
      return false;
    }
    return true;
  }
}
