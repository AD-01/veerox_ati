import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface AtiRequest extends Request {
  user?: { sub?: string };
  workspaceId?: string;
  organizationId?: string;
}

@Injectable()
export class AtiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AtiRequest>();
    
    let token = request.headers['x-ati-token'] as string;
    if (!token && request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedException('Missing ATI Token');
    }

    try {
      // Decode a simple base64 payload to extract tenant boundary.
      // Expected payload format: base64(JSON.stringify({ workspaceId: '...', organizationId: '...' }))
      const payloadStr = Buffer.from(token, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadStr);

      if (!payload.workspaceId || !payload.organizationId) {
        throw new UnauthorizedException('Invalid ATI Token Payload');
      }

      // Enforce the tenant boundary on the request
      request.user = { sub: 'system-ati' };
      request.workspaceId = payload.workspaceId;
      request.organizationId = payload.organizationId;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid ATI Token');
    }
  }
}
