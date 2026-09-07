import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

import {
  ProvisionConnectorCredentialCommand,
  RotateConnectorCredentialCommand,
  RevokeConnectorCredentialCommand,
} from '../../commands/connector-credential.commands';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { SecretGenerator } from '@veerox/shared/src/utils/secret-generator.util';
import { IAuditRepository, AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';
import {
  ConnectorCredentialProvisionedEvent,
  ConnectorCredentialRotatedEvent,
  ConnectorCredentialRevokedEvent,
} from '@veerox/events/src/connector.events';

async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

@CommandHandler(ProvisionConnectorCredentialCommand)
export class ProvisionConnectorCredentialHandler implements ICommandHandler<ProvisionConnectorCredentialCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ProvisionConnectorCredentialCommand): Promise<{ secret: string }> {
    const connector = await this.prisma.connector.findUnique({
      where: { id: command.connectorId },
    });

    if (!connector || connector.workspaceId !== command.workspaceId || connector.organizationId !== command.organizationId) {
      throw new NotFoundException('Connector not found in this context');
    }

    const existingActive = await this.prisma.connectorCredential.findFirst({
      where: {
        connectorId: command.connectorId,
        status: 'ACTIVE',
      },
    });

    if (existingActive) {
      throw new BadRequestException('Connector already has an active credential. Use rotate instead.');
    }

    const secret = SecretGenerator.generateSecret();
    const secretHash = await hashSecret(secret);
    const credentialId = randomUUID();
    const now = new Date();

    await this.prisma.connectorCredential.create({
      data: {
        id: credentialId,
        connectorId: command.connectorId,
        workspaceId: command.workspaceId,
        organizationId: command.organizationId,
        secretHash,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'ProvisionConnectorCredential',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: command.connectorId,
        targetEntityType: 'Connector',
        credentialId,
      }),
      reason: 'User provisioned connector credential',
    });

    this.eventBus.publish(
      new ConnectorCredentialProvisionedEvent(
        credentialId,
        command.connectorId,
        command.workspaceId,
        command.organizationId,
        now,
      ),
    );

    return { secret };
  }
}

@CommandHandler(RotateConnectorCredentialCommand)
export class RotateConnectorCredentialHandler implements ICommandHandler<RotateConnectorCredentialCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RotateConnectorCredentialCommand): Promise<{ secret: string }> {
    const connector = await this.prisma.connector.findUnique({
      where: { id: command.connectorId },
    });

    if (!connector || connector.workspaceId !== command.workspaceId || connector.organizationId !== command.organizationId) {
      throw new NotFoundException('Connector not found in this context');
    }

    const secret = SecretGenerator.generateSecret();
    const secretHash = await hashSecret(secret);
    const newCredentialId = randomUUID();
    const now = new Date();

    let oldCredentialId: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      // Find active credentials and lock for update
      const activeCredentials = await tx.connectorCredential.findMany({
        where: {
          connectorId: command.connectorId,
          status: 'ACTIVE',
        },
      });

      if (activeCredentials.length > 0) {
        oldCredentialId = activeCredentials[0].id;
        await tx.connectorCredential.updateMany({
          where: { connectorId: command.connectorId, status: 'ACTIVE' },
          data: { status: 'ROTATED', updatedAt: now },
        });
      }

      await tx.connectorCredential.create({
        data: {
          id: newCredentialId,
          connectorId: command.connectorId,
          workspaceId: command.workspaceId,
          organizationId: command.organizationId,
          secretHash,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      });
    });

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'RotateConnectorCredential',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: command.connectorId,
        targetEntityType: 'Connector',
        newCredentialId,
        oldCredentialId,
      }),
      reason: 'User rotated connector credential',
    });

    this.eventBus.publish(
      new ConnectorCredentialRotatedEvent(
        oldCredentialId || 'none',
        newCredentialId,
        command.connectorId,
        command.workspaceId,
        command.organizationId,
        now,
      ),
    );

    return { secret };
  }
}

@CommandHandler(RevokeConnectorCredentialCommand)
export class RevokeConnectorCredentialHandler implements ICommandHandler<RevokeConnectorCredentialCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RevokeConnectorCredentialCommand): Promise<void> {
    const connector = await this.prisma.connector.findUnique({
      where: { id: command.connectorId },
    });

    if (!connector || connector.workspaceId !== command.workspaceId || connector.organizationId !== command.organizationId) {
      throw new NotFoundException('Connector not found in this context');
    }

    const now = new Date();
    let oldCredentialId: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      const activeCredentials = await tx.connectorCredential.findMany({
        where: {
          connectorId: command.connectorId,
          status: 'ACTIVE',
        },
      });

      if (activeCredentials.length > 0) {
        oldCredentialId = activeCredentials[0].id;
        await tx.connectorCredential.updateMany({
          where: { connectorId: command.connectorId, status: 'ACTIVE' },
          data: { status: 'REVOKED', updatedAt: now },
        });
      }
    });

    if (oldCredentialId) {
      await this.auditRepository.log({
        actorId: command.actorId,
        action: 'RevokeConnectorCredential',
        newState: JSON.stringify({
          organizationId: command.organizationId,
          workspaceId: command.workspaceId,
          targetEntityId: command.connectorId,
          targetEntityType: 'Connector',
          revokedCredentialId: oldCredentialId,
        }),
        reason: 'User revoked connector credential',
      });

      this.eventBus.publish(
        new ConnectorCredentialRevokedEvent(
          oldCredentialId,
          command.connectorId,
          command.workspaceId,
          command.organizationId,
          now,
        ),
      );
    }
  }
}
