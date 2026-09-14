import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AppException } from './app.exception';
import { Response, Request } from 'express';
import { isSafePublicMessage } from './safe-error.util';
import { RequestContextService } from '../context/request-context.service';
import { redact } from '../utils/redact.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  private safeMessage(message: any, status: number): any {
    if (process.env.NODE_ENV === 'development') return message;
    if (status >= 500) return 'An internal error occurred';
    
    if (isSafePublicMessage(message)) {
      return message;
    }
    
    return 'An error occurred';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = RequestContextService.getCorrelationId();

    if (correlationId) {
      response.setHeader('x-correlation-id', correlationId);
    }

    if (exception instanceof AppException) {
      const isInternal = exception.statusCode >= 500;
      
      if (isInternal) {
        this.logger.error({
          err: exception,
          metadata: redact(exception.metadata),
          method: request.method,
          url: request.url,
        }, `AppException ${exception.statusCode}: ${exception.message}`);
      }

      return response.status(exception.statusCode).json({
        success: false,
        code: (isInternal && process.env.NODE_ENV !== 'development') ? 'INTERNAL_ERROR' : exception.code,
        message: this.safeMessage(exception.message, exception.statusCode),
        correlationId,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as any;
      
      const message = typeof res === 'object' && res.message ? res.message : exception.message;

      if (status >= 500) {
        this.logger.error({
          err: exception,
          method: request.method,
          url: request.url,
        }, `HTTP ${status} Exception: ${exception.message}`);
      }

      return response.status(status).json({
        success: false,
        code: (status >= 500 && process.env.NODE_ENV !== 'development') ? 'INTERNAL_ERROR' : 'HTTP_ERROR',
        message: this.safeMessage(message, status),
        correlationId,
      });
    }

    const msg = exception instanceof Error ? exception.message : 'An unexpected error occurred.';
    
    this.logger.error({
      err: exception,
      method: request.method,
      url: request.url,
    }, `Unhandled Exception: ${msg}`);

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: this.safeMessage(msg, HttpStatus.INTERNAL_SERVER_ERROR),
      correlationId,
    });
  }
}
