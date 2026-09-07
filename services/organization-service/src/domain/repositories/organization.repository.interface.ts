import { Organization } from '../aggregates/organization.aggregate';

export interface IOrganizationRepository {
  save(organization: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findByName(name: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');

