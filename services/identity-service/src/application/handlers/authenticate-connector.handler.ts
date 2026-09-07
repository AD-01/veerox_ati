import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuthenticateConnectorCommand } from '../commands/authenticate-connector.command';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { TokenService, MachineTokenPayload } from '../../infrastructure/auth/token.service';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { ConnectorAuthenticatedEvent } from '@veerox/events/src/connector.events';

export interface ConnectorLoginResult {
  accessToken: string;
  expiresIn: number;
}

@CommandHandler(AuthenticateConnectorCommand)
export class AuthenticateConnectorHandler implements ICommandHandler<AuthenticateConnectorCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AuthenticateConnectorCommand): Promise<ConnectorLoginResult> {
    const connector = await this.prisma.connector.findUnique({
      where: { id: command.connectorId },
      include: {
        credentials: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!connector || connector.status !== 'ACTIVE') {
      await this.logFailedAttempt(command.connectorId, command.ipAddress, 'Connector not found or inactive');
      throw new UnauthorizedException('Invalid connector credentials');
    }

    if (connector.credentials.length === 0) {
      await this.logFailedAttempt(command.connectorId, command.ipAddress, 'No active credentials');
      throw new UnauthorizedException('Invalid connector credentials');
    }

    const credential = connector.credentials[0];
    const isSecretValid = await argon2.verify(credential.secretHash, command.clientSecret);

    if (!isSecretValid) {
      await this.logFailedAttempt(command.connectorId, command.ipAddress, 'Invalid secret');
      throw new UnauthorizedException('Invalid connector credentials');
    }

    const now = new Date();
    await this.prisma.connectorCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: now },
    });

    const payload: MachineTokenPayload = {
      sub: `connector_${connector.id}`,
      type: 'connector',
      workspaceId: connector.workspaceId,
      organizationId: connector.organizationId,
    };

    const tokens = await this.tokenService.generateMachineToken(payload);

    await this.auditRepository.log({
      actorId: `connector_${connector.id}`,
      action: 'ConnectorAuthenticated',
      newState: JSON.stringify({
        organizationId: connector.organizationId,
        workspaceId: connector.workspaceId,
        connectorId: connector.id,
        ipAddress: command.ipAddress,
      }),
      reason: 'Connector successfully authenticated',
    });

    this.eventBus.publish(
      new ConnectorAuthenticatedEvent(
        connector.id,
        connector.workspaceId,
        connector.organizationId,
        command.ipAddress,
        now,
      ),
    );

    return tokens;
  }

  private async logFailedAttempt(connectorId: string, ipAddress: string, reason: string) {
    await this.auditRepository.log({
      actorId: 'system',
      action: 'ConnectorAuthenticationFailed',
      newState: JSON.stringify({
        connectorId,
        ipAddress,
      }),
      reason,
    });
  }
}
