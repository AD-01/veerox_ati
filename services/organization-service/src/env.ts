import { baseEnvSchema } from '@veerox/shared';

export const envSchema = baseEnvSchema.extend({
  // Service specific vars
});

export function validateEnv() {
  return envSchema.parse(process.env);
}
