import { Controller, Post, Param, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { v4 as uuidv4 } from 'uuid';

import * as crypto from 'crypto';

@Controller('organizations/:orgId/workspaces/:workspaceId/connectors/:id')
export class ConnectorProvisioningController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('provision')
  async provisionAgent(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectorId: string,
  ) {
    const connector = await this.prisma.connector.findUnique({
      where: { id: connectorId },
    });

    if (!connector) {
      throw new Error('Connector not found');
    }

    if (connector.organizationId !== orgId || connector.workspaceId !== workspaceId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    const agentId = connectorId;
    const agentSecret = crypto.randomBytes(32).toString('hex');
    
    // Encrypt the secret for symmetric HMAC verification later
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_byte_secret_key_mock_12';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
    
    let encrypted = cipher.update(agentSecret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Store as `aes:{iv}:{encrypted}:{authTag}` in the secretHash field to avoid schema changes
    const secretHash = `aes:${iv.toString('hex')}:${encrypted}:${authTag}`;

    await this.prisma.$transaction(async (tx) => {

      await tx.connectorCredential.create({
        data: {
          connectorId,
          organizationId: orgId,
          workspaceId,
          secretHash,
          createdAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'AGENT_PROVISIONED',
          actorId: 'SYSTEM',
          targetEntityId: connectorId,
          targetEntityType: 'Connector',
          organizationId: orgId,
          workspaceId: workspaceId,
          reason: `Provisioned agent ${agentId} for connector`,
        },
      });
    });

    return {
      agentId,
      connectorId,
      agentSecret,
    };
  }
}
