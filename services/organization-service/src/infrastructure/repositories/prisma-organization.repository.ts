import { Injectable } from '@nestjs/common';
import { IOrganizationRepository } from '../../domain/repositories/organization.repository.interface';
import { Organization, OrganizationStatus } from '../../domain/aggregates/organization.aggregate';
import { PrismaService } from '@veerox/database';

@Injectable()
export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(organization: Organization): Promise<void> {
    const data = {
      name: organization.name,
      slug: organization.slug,
      ownerUserId: organization.ownerUserId,
      subscriptionPlan: organization.subscriptionPlan,
      subscriptionStatus: organization.subscriptionStatus,
      timezone: organization.timezone,
      currency: organization.currency,
      status: organization.status,
      createdAt: organization.createdAt,
    };

    await this.prisma.organization.upsert({
      where: { id: organization.id },
      update: data,
      create: {
        id: organization.id,
        ...data,
      },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByName(name: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { name } });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { slug } });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToDomain(record: any): Organization {
    const org = Organization.load({
      id: record.id,
      name: record.name,
      slug: record.slug,
      ownerUserId: record.ownerUserId,
      subscriptionPlan: record.subscriptionPlan,
      subscriptionStatus: record.subscriptionStatus,
      timezone: record.timezone,
      currency: record.currency,
      status: record.status as OrganizationStatus,
      createdAt: record.createdAt,
    });
    return org;
  }
}
