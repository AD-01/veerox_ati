import { License } from '../aggregates/license.aggregate';

export interface ILicenseRepository {
  findById(id: string, tx?: any): Promise<License | null>;
  findByWorkspaceAndProduct(workspaceId: string, productId: string, tx?: any): Promise<License | null>;
  save(license: License, tx?: any): Promise<void>;
}
