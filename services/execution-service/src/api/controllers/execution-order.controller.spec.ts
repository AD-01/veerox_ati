import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { ExecutionOrderController } from './execution-order.controller';
import { GetExecutionOrdersQuery } from '../../application/queries/get-execution-orders.query';
import { PrismaService } from '@veerox/database';
import { WorkspaceAuthorizationService } from '@veerox/shared';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
describe('ExecutionOrderController', () => {
  let controller: ExecutionOrderController;
  let queryBus: QueryBus;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionOrderController],
      providers: [
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              {
                id: 'order-123',
                workspaceId: 'ws-123',
                accountId: 'acc-123',
                orderType: 'MARKET',
                side: 'BUY',
                status: 'FILLED',
                size: 1.5,
              },
            ]),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            tradingAccount: {
              findUnique: jest.fn(),
            },
          },
        }
      ],
    }).compile();

    controller = module.get<ExecutionOrderController>(ExecutionOrderController);
    queryBus = module.get<QueryBus>(QueryBus);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return orders for a workspace', async () => {
    const result = await controller.getWorkspaceOrders('ws-123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-123');
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetExecutionOrdersQuery('ws-123', undefined, 50, 0),
    );
  });

  describe('getAccountOrders', () => {
    it('should throw NotFoundException if account does not exist', async () => {
      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue(null);
      const req = { user: { userRoles: [] } };
      await expect(controller.getAccountOrders('acc-123', req)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no roles mapping', async () => {
      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue({ workspaceId: 'ws-1', organizationId: 'org-1' } as any);
      const req = { user: {} };
      await expect(controller.getAccountOrders('acc-123', req)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user lacks workspace privileges', async () => {
      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue({ workspaceId: 'ws-1', organizationId: 'org-1' } as any);
      jest.spyOn(WorkspaceAuthorizationService, 'canReadWorkspace').mockReturnValue(false);
      const req = { user: { userRoles: [] } };
      await expect(controller.getAccountOrders('acc-123', req)).rejects.toThrow(ForbiddenException);
    });

    it('should return orders if user has workspace privileges', async () => {
      jest.spyOn(prisma.tradingAccount, 'findUnique').mockResolvedValue({ workspaceId: 'ws-1', organizationId: 'org-1' } as any);
      jest.spyOn(WorkspaceAuthorizationService, 'canReadWorkspace').mockReturnValue(true);
      const req = { user: { userRoles: [{ role: 'WORKSPACE_READ', workspaceId: 'ws-1', organizationId: 'org-1' }] } };
      
      const result = await controller.getAccountOrders('acc-123', req);
      expect(result).toHaveLength(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetExecutionOrdersQuery(undefined, 'acc-123', 50, 0),
      );
    });
  });
});
