export const SAFE_PUBLIC_MESSAGES = new Set([
  'invalid credentials',
  'invalid email or password',
  'unauthorized',
  'forbidden',
  'workspace access denied',
  'duplicate resource',
  'workspace already exists',
  'invalid email address',
  'rate limit exceeded',
  'too many login attempts',
  'too many login attempts or authentication service unavailable. please try again later.',
  'bad request',
  'not found',
  'conflict',
  'email must be an email'
]);

export function isSafePublicMessage(message: any): boolean {
  if (!message) return true;
  
  if (Array.isArray(message)) {
    return message.every(m => typeof m === 'string' && SAFE_PUBLIC_MESSAGES.has(m.toLowerCase()));
  }
  
  if (typeof message === 'string') {
    return SAFE_PUBLIC_MESSAGES.has(message.toLowerCase());
  }

  return false;
}
