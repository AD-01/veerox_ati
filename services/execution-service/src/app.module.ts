import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';
﻿import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ExecutionModule } from './execution.module';

@Module({
  imports: [
    ObservabilityModule,ExecutionModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

