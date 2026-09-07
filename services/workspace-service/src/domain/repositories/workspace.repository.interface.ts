import { Workspace } from '../aggregates/workspace.aggregate';

export interface IWorkspaceRepository {
  save(workspace: Workspace): Promise<void>;
  findById(id: string): Promise<Workspace | null>;
  findByNameAndOrganization(name: string, organizationId: string): Promise<Workspace | null>;
}

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');
