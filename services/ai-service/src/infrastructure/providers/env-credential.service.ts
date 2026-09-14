import { Injectable, Logger } from '@nestjs/common';
import { ICredentialService } from '../../domain/providers/credential.service.interface';
import { AppException } from '@veerox/shared';

@Injectable()
export class EnvCredentialService implements ICredentialService {
  private readonly logger = new Logger(EnvCredentialService.name);

  async getProviderCredentials(providerName: string, organizationId: string, workspaceId: string): Promise<Record<string, string>> {
    this.logger.debug(`Fetching credentials for org: ${organizationId}, ws: ${workspaceId}`);
    // In a real implementation, this would query a secret manager (AWS Secrets Manager, HashiCorp Vault)
    // using the orgId and workspaceId. For Phase 02, we fallback to env vars to ensure
    // NO PLAINTEXT SECRETS exist in the codebase.
    
    const providerUpper = providerName.toUpperCase();
    const credentials: Record<string, string> = {};

    if (providerUpper === 'OPENAI') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new AppException('UNAUTHORIZED', 'OPENAI_API_KEY not configured in environment');
      credentials['OPENAI_API_KEY'] = key;
    } else if (providerUpper === 'ANTHROPIC') {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new AppException('UNAUTHORIZED', 'ANTHROPIC_API_KEY not configured in environment');
      credentials['ANTHROPIC_API_KEY'] = key;
    } else {
      throw new AppException('BAD_REQUEST', `No credential strategy found for provider: ${providerName}`);
    }

    return credentials;
  }
}
