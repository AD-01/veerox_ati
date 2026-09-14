import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { BillingModule } from './billing.module';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';

@Module({
  imports: [
    ObservabilityModule,BillingModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
