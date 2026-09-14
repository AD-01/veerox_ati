import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationHandler } from './create-organization.handler';
import { PrismaService } from '@veerox/database';
import { CreateOrganizationCommand } from '../commands/create-organization.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { EventBus } from '@nestjs/cqrs';

describe('CreateOrganizationHandler', () => {
  let handler: CreateOrganizationHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let organizationRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eventBus: any;

  beforeEach(async () => {
    organizationRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findByName: jest.fn().mockResolvedValue(null),
      findBySlug: jest.fn().mockResolvedValue(null),
    };
    auditRepository = {
      logAction: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOrganizationHandler,
        { provide: PrismaService, useValue: { role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-id' }) }, userRole: { create: jest.fn().mockResolvedValue({}) }, organizationMember: { create: jest.fn().mockResolvedValue({}) } } },
        { provide: ORGANIZATION_REPOSITORY, useValue: organizationRepository },
        { provide: AUDIT_REPOSITORY, useValue: auditRepository },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<CreateOrganizationHandler>(CreateOrganizationHandler);
  });

  it('should create an organization successfully', async () => {
    const command = new CreateOrganizationCommand(
      'Acme Corp',
      'acme-corp',
      'user-1',
      'UTC',
      'USD'
    );

    const result = await handler.execute(command);

    expect(result).toBeDefined();
    expect(organizationRepository.save).toHaveBeenCalledTimes(1);
    expect(auditRepository.log).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    
    // Ensure audit gets correct action
    expect(auditRepository.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'CreateOrganization',
      })
    );
  });
});
