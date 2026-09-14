import { License } from '../aggregates/license.aggregate';

export interface ILicenseRepository {
  findById(id: string): Promise<License | null>;
  findByWorkspaceAndProduct(workspaceId: string, productId: string): Promise<License | null>;
  save(license: License, tx?: any): Promise<void>;
}
