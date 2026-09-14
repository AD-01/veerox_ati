import { Authenticator } from '../core/authenticator';

describe('Authenticator', () => {
  const secret = 'super-secret-agent-key';
  const agentId = 'agent-123';
  let authenticator: Authenticator;

  beforeEach(() => {
    authenticator = new Authenticator(secret, agentId);
  });

  it('should generate valid HMAC response', () => {
    const nonce = 'random-nonce';
    const timestamp = new Date().toISOString();
    
    const signature = authenticator.generateResponse(nonce, timestamp);
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
  });

  it('should reject challenge timestamp with skew > 5s', () => {
    // 6 seconds in the past
    const skewedTime = new Date(Date.now() - 6000).toISOString();
    expect(authenticator.verifyChallenge(skewedTime)).toBe(false);

    // 6 seconds in the future
    const skewedFuture = new Date(Date.now() + 6000).toISOString();
    expect(authenticator.verifyChallenge(skewedFuture)).toBe(false);
  });

  it('should accept challenge timestamp with skew < 5s', () => {
    // 2 seconds in the past
    const validTime = new Date(Date.now() - 2000).toISOString();
    expect(authenticator.verifyChallenge(validTime)).toBe(true);
  });
});
