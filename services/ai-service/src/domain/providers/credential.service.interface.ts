export const CREDENTIAL_SERVICE = Symbol('CREDENTIAL_SERVICE');

export interface ICredentialService {
  getProviderCredentials(providerName: string, organizationId: string, workspaceId: string): Promise<Record<string, string>>;
}
