const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'ati_access_token',
  'clientsecret',
  'secret',
  'apikey',
  'brokerpassword',
  'brokersecret',
  'databaseurl',
  'redisurl',
  'rabbitmqurl'
]);

export function redact(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (seen.has(obj)) {
    return '[CIRCULAR]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item, seen));
  }

  const result: any = {};
  
  // Handle Error objects properly by extracting non-enumerable properties
  if (obj instanceof Error) {
    result.name = obj.name;
    result.message = obj.message;
    if (obj.stack) result.stack = obj.stack;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redact(value, seen);
    }
  }

  return result;
}
