import { Injectable } from '@nestjs/common';
import { IWorkspaceRepository } from '../../domain/repositories/workspace.repository.interface';
import { Workspace, WorkspaceStatus } from '../../domain/aggregates/workspace.aggregate';
import { WorkspaceConfig, WorkspaceConfigProps } from '../../domain/value-objects/workspace-config.vo';
import { PrismaService } from '@veerox/database/src/prisma.service';

@Injectable()
export class PrismaWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(workspace: Workspace): Promise<void> {
    const config = workspace.configuration?.toPrimitive();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.$transaction(async (tx: any) => {
      // Upsert workspace
      await tx.workspace.upsert({
        where: { id: workspace.id },
        create: {
          id: workspace.id,
          organizationId: workspace.organizationId,
          name: workspace.name,
          status: workspace.status,
          createdAt: workspace.createdAt,
        },
        update: {
          name: workspace.name,
          status: workspace.status,
        },
      });

      // Upsert config if present
      if (config) {
        await tx.workspaceConfig.upsert({
          where: { workspaceId: workspace.id },
          create: {
            workspaceId: workspace.id,
            tradingPolicies: config.tradingPolicies,
            riskLimits: config.riskLimits,
            notificationSettings: config.notificationSettings,
            strategyPreferences: config.strategyPreferences,
            automationMode: config.automationMode,
          },
          update: {
            tradingPolicies: config.tradingPolicies,
            riskLimits: config.riskLimits,
            notificationSettings: config.notificationSettings,
            strategyPreferences: config.strategyPreferences,
            automationMode: config.automationMode,
          },
        });
      }

      const currentMemberIds = Array.from(workspace.memberRoles.keys());
      
      if (currentMemberIds.length > 0) {
        await tx.workspaceMember.deleteMany({
          where: {
            workspaceId: workspace.id,
            userId: { notIn: currentMemberIds }
          }
        });
        await tx.userRole.deleteMany({
          where: {
            workspaceId: workspace.id,
            userId: { notIn: currentMemberIds }
          }
        });

        for (const [userId, roleName] of workspace.memberRoles.entries()) {
          await tx.workspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: workspace.id,
                userId: userId
              }
            },
            create: {
              workspaceId: workspace.id,
              userId: userId,
              status: 'ACTIVE',
            },
            update: {
              status: 'ACTIVE',
            }
          });

          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (!role) {
             throw new Error(`Role ${roleName} not found in database`);
          }

          // Clean up old roles for this user in this workspace
          await tx.userRole.deleteMany({
            where: {
              workspaceId: workspace.id,
              userId: userId
            }
          });

          await tx.userRole.create({
            data: {
              userId: userId,
              organizationId: workspace.organizationId,
              workspaceId: workspace.id,
              roleId: role.id
            }
          });
        }
      } else {
        await tx.workspaceMember.deleteMany({
          where: { workspaceId: workspace.id }
        });
        await tx.userRole.deleteMany({
          where: { workspaceId: workspace.id }
        });
      }
    });
  }

  async findById(id: string): Promise<Workspace | null> {
    const data = await this.prisma.workspace.findUnique({
      where: { id },
      include: { configuration: true, members: true },
    });

    if (!data) return null;

    const userRoles = await this.prisma.userRole.findMany({
      where: { workspaceId: id },
      include: { role: true }
    });

    return this.mapToDomain(data, userRoles);
  }

  async findByNameAndOrganization(name: string, organizationId: string): Promise<Workspace | null> {
    const data = await this.prisma.workspace.findFirst({
      where: { name, organizationId },
      include: { configuration: true, members: true },
    });

    if (!data) return null;

    const userRoles = await this.prisma.userRole.findMany({
      where: { workspaceId: data.id },
      include: { role: true }
    });

    return this.mapToDomain(data, userRoles);
  }

  private mapToDomain(
    data: { 
      id: string; 
      organizationId: string; 
      name: string; 
      status: string; 
      createdAt: Date; 
      configuration?: Record<string, unknown> | null; 
      members?: Array<{ userId: string }> 
    }, 
    userRoles: Array<{ userId: string; role?: { name: string } }> = []
  ): Workspace {
    let configProps: WorkspaceConfigProps | undefined = undefined;
    if (data.configuration) {
      configProps = {
        tradingPolicies: data.configuration.tradingPolicies as string,
        riskLimits: data.configuration.riskLimits as string,
        notificationSettings: data.configuration.notificationSettings as string,
        strategyPreferences: data.configuration.strategyPreferences as string,
        automationMode: data.configuration.automationMode as "MANUAL" | "SEMI_AUTO" | "FULL_AUTO",
      };
    }

    const rolesMap = new Map<string, string>();
    for (const r of userRoles) {
      if (r.role && r.role.name) {
        rolesMap.set(r.userId, r.role.name);
      }
    }

    const memberRoles = data.members 
      ? new Map<string, string>(data.members.map((m: { userId: string }) => [m.userId, rolesMap.get(m.userId) || 'UNKNOWN']))
      : new Map<string, string>();

    const workspace = Workspace.load({
      id: data.id,
      organizationId: data.organizationId,
      name: data.name,
      status: data.status as WorkspaceStatus,
      createdAt: data.createdAt,
      configuration: configProps ? WorkspaceConfig.create(configProps) : undefined,
      memberRoles: memberRoles,
    });

    return workspace;
  }
}
