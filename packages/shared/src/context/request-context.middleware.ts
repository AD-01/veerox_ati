import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';
import * as crypto from 'crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let correlationId = req.headers['x-correlation-id'] as string;
    
    // Must be a valid UUID to be trusted. Otherwise, generate a fresh one.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!correlationId || !uuidRegex.test(correlationId)) {
      correlationId = crypto.randomUUID();
    }

    const store = new Map<string, any>();
    store.set('correlationId', correlationId);

    RequestContextService.run(store, () => {
      next();
    });
  }
}
