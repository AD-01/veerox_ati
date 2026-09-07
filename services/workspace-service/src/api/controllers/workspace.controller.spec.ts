import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { CreateWorkspaceCommand } from '../../application/commands/create-workspace.command';
import { ListWorkspacesQuery, GetWorkspaceQuery, ListWorkspaceMembersQuery } from '../../application/queries/workspace.queries';
import { RestoreWorkspaceCommand } from '../../application/commands/restore-workspace.command';
import { DeleteWorkspaceCommand } from '../../application/commands/delete-workspace.command';
import { AddWorkspaceMemberCommand } from '../../application/commands/add-workspace-member.command';
import { RemoveWorkspaceMemberCommand } from '../../application/commands/remove-workspace-member.command';
import { UpdateWorkspaceMemberRoleCommand } from '../../application/commands/update-workspace-member-role.command';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should dispatch CreateWorkspaceCommand', async () => {
      const mockReq = {
        user: { userId: 'user-1' }
      } as unknown as Request;

      jest.spyOn(commandBus, 'execute').mockResolvedValue('workspace-1');

      const result = await controller.createWorkspace(mockReq, 'org-1', {
        name: 'Test Workspace',
        automationMode: 'SEMI_AUTO',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new CreateWorkspaceCommand(
          'org-1',
          'user-1',
          'Test Workspace',
          undefined,
          undefined,
          undefined,
          undefined,
          'SEMI_AUTO'
        )
      );
      expect(result).toEqual({ id: 'workspace-1', message: 'Workspace created successfully' });
    });
  });

  describe('listWorkspaces', () => {
    it('should query without filtering if user is an Org Admin', async () => {
      const mockReq = {
        user: {
          userId: 'user-1',
          userRoles: [
            {
              role: { name: 'Organization Admin' },
              organizationId: 'org-1',
              workspaceId: null,
            }
          ]
        }
      } as unknown as Request;

      jest.spyOn(queryBus, 'execute').mockResolvedValue([{ id: 'workspace-1' }]);

      const result = await controller.listWorkspaces(mockReq, 'org-1');

      expect(queryBus.execute).toHaveBeenCalledWith(new ListWorkspacesQuery('org-1', undefined));
      expect(result).toEqual([{ id: 'workspace-1' }]);
    });

    it('should query with filtered workspace IDs if user is only Workspace Admin', async () => {
      const mockReq = {
        user: {
          userId: 'user-2',
          userRoles: [
            {
              role: { name: 'Workspace Admin' },
              organizationId: 'org-1',
              workspaceId: 'workspace-1',
            }
          ]
        }
      } as unknown as Request;

      jest.spyOn(queryBus, 'execute').mockResolvedValue([{ id: 'workspace-1' }]);

      const result = await controller.listWorkspaces(mockReq, 'org-1');

      expect(queryBus.execute).toHaveBeenCalledWith(new ListWorkspacesQuery('org-1', ['workspace-1']));
      expect(result).toEqual([{ id: 'workspace-1' }]);
    });

    it('should return empty array if user has no relevant roles for this org', async () => {
      const mockReq = {
        user: {
          userId: 'user-3',
          userRoles: [
            {
              role: { name: 'Workspace Admin' },
              organizationId: 'org-2',
              workspaceId: 'workspace-99',
            }
          ]
        }
      } as unknown as Request;

      jest.spyOn(queryBus, 'execute');

      const result = await controller.listWorkspaces(mockReq, 'org-1');

      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getWorkspace', () => {
    it('should dispatch GetWorkspaceQuery', async () => {
      const mockReq = {
        user: { userId: 'user-1' }
      } as unknown as Request;

      jest.spyOn(queryBus, 'execute').mockResolvedValue({ id: 'workspace-1' });

      const result = await controller.getWorkspace(mockReq, 'org-1', 'workspace-1');

      expect(queryBus.execute).toHaveBeenCalledWith(new GetWorkspaceQuery('workspace-1', 'org-1'));
      expect(result).toEqual({ id: 'workspace-1' });
    });
  });

  describe('restoreWorkspace', () => {
    it('should dispatch RestoreWorkspaceCommand', async () => {
      const mockReq = { user: { userId: 'user-1' } } as unknown as Request;
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      const result = await controller.restoreWorkspace(mockReq, 'org-1', 'workspace-1');

      expect(commandBus.execute).toHaveBeenCalledWith(new RestoreWorkspaceCommand('workspace-1', 'org-1', 'user-1'));
      expect(result).toEqual({ message: 'Workspace restored successfully' });
    });
  });

  describe('deleteWorkspace', () => {
    it('should dispatch DeleteWorkspaceCommand', async () => {
      const mockReq = { user: { userId: 'user-1' } } as unknown as Request;
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      const result = await controller.deleteWorkspace(mockReq, 'org-1', 'workspace-1');

      expect(commandBus.execute).toHaveBeenCalledWith(new DeleteWorkspaceCommand('workspace-1', 'org-1', 'user-1'));
      expect(result).toEqual({ message: 'Workspace deleted successfully' });
    });
  });

  describe('listWorkspaceMembers', () => {
    it('should dispatch ListWorkspaceMembersQuery', async () => {
      const mockReq = {} as Request;
      jest.spyOn(queryBus, 'execute').mockResolvedValue([{ userId: 'u1' }]);

      const result = await controller.listWorkspaceMembers(mockReq, 'org-1', 'workspace-1');

      expect(queryBus.execute).toHaveBeenCalledWith(new ListWorkspaceMembersQuery('workspace-1', 'org-1'));
      expect(result).toEqual([{ userId: 'u1' }]);
    });
  });

  describe('addWorkspaceMember', () => {
    it('should dispatch AddWorkspaceMemberCommand', async () => {
      const mockReq = { user: { userId: 'user-1' } } as unknown as Request;
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      const result = await controller.addWorkspaceMember(mockReq, 'org-1', 'workspace-1', { userId: 'u2', role: 'Trader' });

      expect(commandBus.execute).toHaveBeenCalledWith(new AddWorkspaceMemberCommand('workspace-1', 'org-1', 'u2', 'Trader', 'user-1'));
      expect(result).toEqual({ message: 'Workspace member added successfully' });
    });
  });

  describe('removeWorkspaceMember', () => {
    it('should dispatch RemoveWorkspaceMemberCommand', async () => {
      const mockReq = { user: { userId: 'user-1' } } as unknown as Request;
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      const result = await controller.removeWorkspaceMember(mockReq, 'org-1', 'workspace-1', 'u2');

      expect(commandBus.execute).toHaveBeenCalledWith(new RemoveWorkspaceMemberCommand('workspace-1', 'org-1', 'u2', 'user-1'));
      expect(result).toEqual({ message: 'Workspace member removed successfully' });
    });
  });

  describe('updateWorkspaceMemberRole', () => {
    it('should dispatch UpdateWorkspaceMemberRoleCommand', async () => {
      const mockReq = { user: { userId: 'user-1' } } as unknown as Request;
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      const result = await controller.updateWorkspaceMemberRole(mockReq, 'org-1', 'workspace-1', 'u2', { role: 'Admin' });

      expect(commandBus.execute).toHaveBeenCalledWith(new UpdateWorkspaceMemberRoleCommand('workspace-1', 'org-1', 'u2', 'Admin', 'user-1'));
      expect(result).toEqual({ message: 'Workspace member role updated successfully' });
    });
  });
});
