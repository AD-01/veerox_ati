import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateConnectorCommand, UpdateConnectorCommand, ArchiveConnectorCommand, IssueConnectorCommand } from '../../commands/connector.commands';
import { PrismaConnectorRepository } from '../../../infrastructure/repositories/prisma-connector.repository';
import { Connector } from '../../../domain/aggregates/connector.aggregate';
import { randomUUID } from 'crypto';
import { NotFoundException, Inject } from '@nestjs/common';
import { IAuditRepository, AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';

@CommandHandler(CreateConnectorCommand)
export class CreateConnectorHandler implements ICommandHandler<CreateConnectorCommand> {
  constructor(
    private readonly repository: PrismaConnectorRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateConnectorCommand): Promise<string> {
    const connectorId = randomUUID();
    const connector = Connector.create(
      connectorId,
      command.organizationId,
      command.workspaceId,
      command.name,
      command.provider,
    );

    await this.repository.save(connector);
    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'CreateConnector',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: connectorId,
        targetEntityType: 'Connector',
        data: connector
      }),
      reason: 'User created new connector',
    });

    for (const event of connector.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    connector.commit();

    return connectorId;
  }
}

@CommandHandler(UpdateConnectorCommand)
export class UpdateConnectorHandler implements ICommandHandler<UpdateConnectorCommand> {
  constructor(
    private readonly repository: PrismaConnectorRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateConnectorCommand): Promise<void> {
    const connector = await this.repository.findById(
      command.connectorId,
      command.organizationId,
      command.workspaceId,
    );

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    const previousState = JSON.stringify(connector);
    connector.update(command.name);
    await this.repository.save(connector);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'UpdateConnector',
      previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: connector.id,
        targetEntityType: 'Connector',
        data: connector
      }),
      reason: 'User updated connector',
    });

    for (const event of connector.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    connector.commit();
  }
}

@CommandHandler(ArchiveConnectorCommand)
export class ArchiveConnectorHandler implements ICommandHandler<ArchiveConnectorCommand> {
  constructor(
    private readonly repository: PrismaConnectorRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ArchiveConnectorCommand): Promise<void> {
    const connector = await this.repository.findById(
      command.connectorId,
      command.organizationId,
      command.workspaceId,
    );

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    const previousState = JSON.stringify(connector);
    connector.archive();
    await this.repository.save(connector);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'ArchiveConnector',
      previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: connector.id,
        targetEntityType: 'Connector',
        data: connector
      }),
      reason: 'User archived connector',
    });

    for (const event of connector.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    connector.commit();
  }
}

@CommandHandler(IssueConnectorCommand)
export class IssueConnectorCommandHandler implements ICommandHandler<IssueConnectorCommand> {
  constructor(
    private readonly repository: PrismaConnectorRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: IssueConnectorCommand): Promise<void> {
    const connector = await this.repository.findById(
      command.connectorId,
      command.organizationId,
      command.workspaceId,
    );

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    const commandId = randomUUID();
    connector.issueCommand(commandId, command.commandType, command.payloadJson);
    await this.repository.save(connector);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'IssueConnectorCommand',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: connector.id,
        targetEntityType: 'Connector',
        commandId,
        commandType: command.commandType,
      }),
      reason: 'System issued command to connector',
    });

    for (const event of connector.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    connector.commit();
  }
}
