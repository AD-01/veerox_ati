import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RequestContextService } from '../context/request-context.service';
import { redact } from '../utils/redact.util';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        customProps: () => ({
          correlationId: RequestContextService.getCorrelationId(),
        }),
        serializers: {
          req: (req) => {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
          res: (res) => ({
            statusCode: res.statusCode,
          }),
          err: (err) => err,
        },
        formatters: {
          log: (object) => {
            return redact(object);
          }
        },
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      },
    }),
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule {}
